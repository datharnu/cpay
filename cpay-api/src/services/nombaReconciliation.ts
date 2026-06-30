import { Op } from "sequelize";
import { Partner, Payment } from "../models";
import { nairaToKobo } from "./ledger";
import {
  fetchAccountTransactions,
  fetchVirtualAccount,
  fetchVirtualAccountTransactions,
} from "./nombaClient";

export type ReconciliationDrift = {
  partnerId?: string;
  partnerName?: string;
  virtualAccountNumber?: string;
  nombaTransactionId?: string;
  sessionId?: string;
  amountNaira: number;
  issue: "orphan_on_nomba" | "orphan_local" | "amount_mismatch";
  localPaymentId?: string;
};

export async function verifyPartnerVirtualAccount(partnerId: string) {
  const partner = await Partner.findByPk(partnerId);
  if (!partner?.virtualAccountNumber) {
    throw new Error("Partner has no virtual account");
  }

  const nomba = await fetchVirtualAccount(partner.virtualAccountNumber);
  return {
    partnerId: partner.id,
    local: {
      accountNumber: partner.virtualAccountNumber,
      accountName: partner.bankAccountName,
      bankName: partner.bankName,
    },
    nomba: nomba.data,
  };
}

export async function getPartnerNombaTransactions(partnerId: string) {
  const partner = await Partner.findByPk(partnerId);
  if (!partner?.virtualAccountNumber) {
    throw new Error("Partner has no virtual account");
  }

  const nomba = await fetchVirtualAccountTransactions(
    partner.virtualAccountNumber
  );

  return {
    partnerId: partner.id,
    virtualAccountNumber: partner.virtualAccountNumber,
    transactions: nomba.data?.results ?? [],
  };
}

export async function reconcileWithNomba(): Promise<{
  drifts: ReconciliationDrift[];
  nombaCount: number;
  localCount: number;
  syncedAt: string;
}> {
  const partners = await Partner.findAll({
    where: { virtualAccountNumber: { [Op.ne]: null } },
  });

  const partnerByVa = new Map(
    partners
      .filter((p) => p.virtualAccountNumber)
      .map((p) => [p.virtualAccountNumber!, p])
  );

  const localPayments = await Payment.findAll({
    where: { partnerId: { [Op.ne]: null } },
  });

  const drifts: ReconciliationDrift[] = [];
  const seenNombaIds = new Set<string>();

  // Per-partner VA transactions from Nomba Transactions API
  for (const partner of partners) {
    if (!partner.virtualAccountNumber) continue;

    try {
      const { data } = await fetchVirtualAccountTransactions(
        partner.virtualAccountNumber
      );
      const rows = data?.results ?? [];

      for (const tx of rows) {
        const txId = tx.transactionId ?? tx.sessionId;
        if (!txId) continue;
        seenNombaIds.add(txId);

        const amountKobo = nairaToKobo(Number(tx.amount ?? 0));
        const local = localPayments.find(
          (p) =>
            p.nombaTransactionId === tx.transactionId ||
            p.sessionId === tx.sessionId
        );

        if (!local) {
          drifts.push({
            partnerId: partner.id,
            partnerName: partner.fullName,
            virtualAccountNumber: partner.virtualAccountNumber,
            nombaTransactionId: tx.transactionId,
            sessionId: tx.sessionId,
            amountNaira: Number(tx.amount ?? 0),
            issue: "orphan_on_nomba",
          });
        } else if (local.amountKobo !== amountKobo) {
          drifts.push({
            partnerId: partner.id,
            partnerName: partner.fullName,
            virtualAccountNumber: partner.virtualAccountNumber,
            nombaTransactionId: tx.transactionId,
            sessionId: tx.sessionId,
            amountNaira: Number(tx.amount ?? 0),
            issue: "amount_mismatch",
            localPaymentId: local.id,
          });
        }
      }
    } catch (err) {
      console.warn(`Reconcile skip ${partner.fullName}:`, err);
    }
  }

  // Local payments not found on Nomba
  for (const payment of localPayments) {
    const nombaId = payment.nombaTransactionId ?? payment.sessionId;
    if (nombaId && !seenNombaIds.has(nombaId)) {
      const partner = payment.partnerId
        ? await Partner.findByPk(payment.partnerId)
        : null;
      drifts.push({
        partnerId: partner?.id,
        partnerName: partner?.fullName,
        virtualAccountNumber: payment.virtualAccountNumber ?? undefined,
        amountNaira: payment.amountKobo / 100,
        issue: "orphan_local",
        localPaymentId: payment.id,
      });
    }
  }

  let nombaCount = 0;
  try {
    const parent = await fetchAccountTransactions();
    nombaCount = parent.data?.results?.length ?? 0;
  } catch {
    nombaCount = seenNombaIds.size;
  }

  return {
    drifts,
    nombaCount,
    localCount: localPayments.length,
    syncedAt: new Date().toISOString(),
  };
}
