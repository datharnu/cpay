import { Op } from "sequelize";
import { Partner, Payment } from "../models";
import { nairaToKobo } from "./ledger";
import {
  fetchAccountTransactions,
  fetchVirtualAccount,
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

function parseNombaTxAmountNaira(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;

  // Sandbox parent-account rows often use kobo strings (e.g. "10000" = ₦100).
  if (typeof raw === "string" && /^\d+$/.test(raw) && n >= 1000 && n % 100 === 0) {
    const asNaira = n / 100;
    if (asNaira > 0 && asNaira <= 150) return asNaira;
  }

  return n;
}

function findPartnerVaInTx(
  partnerVas: Map<string, Partner>,
  tx: Record<string, unknown>
): Partner | null {
  const blob = JSON.stringify(tx);
  for (const [va, partner] of partnerVas) {
    if (blob.includes(va)) return partner;
  }

  const direct = String(
    tx.aliasAccountNumber ??
      tx.bankAccountNumber ??
      tx.virtualAccountNumber ??
      ""
  );
  return partnerVas.get(direct) ?? null;
}

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

  const { data } = await fetchAccountTransactions();
  const rows = (data?.results ?? []).filter((tx) => {
    const blob = JSON.stringify(tx);
    return blob.includes(partner.virtualAccountNumber!);
  });

  return {
    partnerId: partner.id,
    virtualAccountNumber: partner.virtualAccountNumber,
    transactions: rows,
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

  const partnerVas = new Map(
    partners
      .filter((p) => p.virtualAccountNumber)
      .map((p) => [p.virtualAccountNumber!, p])
  );

  const localPayments = await Payment.findAll({
    where: { partnerId: { [Op.ne]: null } },
  });

  const drifts: ReconciliationDrift[] = [];
  const seenNombaIds = new Set<string>();

  let nombaRows: Array<Record<string, unknown>> = [];
  try {
    const { data } = await fetchAccountTransactions();
    nombaRows = (data?.results ?? []) as Array<Record<string, unknown>>;
  } catch (err) {
    console.warn("Reconcile: could not fetch Nomba account transactions:", err);
  }

  for (const tx of nombaRows) {
    const partner = findPartnerVaInTx(partnerVas, tx);
    if (!partner?.virtualAccountNumber) continue;

    const txId = String(tx.transactionId ?? tx.id ?? tx.sessionId ?? "");
    if (!txId) continue;
    seenNombaIds.add(txId);

    const amountNaira = parseNombaTxAmountNaira(
      tx.transactionAmount ?? tx.amount
    );
    if (amountNaira <= 0) continue;

    const local = localPayments.find(
      (p) =>
        p.nombaTransactionId === tx.transactionId ||
        p.sessionId === tx.sessionId ||
        p.nombaTransactionId === tx.id
    );

    const amountKobo = nairaToKobo(amountNaira);

    if (!local) {
      drifts.push({
        partnerId: partner.id,
        partnerName: partner.fullName,
        virtualAccountNumber: partner.virtualAccountNumber,
        nombaTransactionId: txId,
        sessionId: String(tx.sessionId ?? ""),
        amountNaira,
        issue: "orphan_on_nomba",
      });
    } else if (local.amountKobo !== amountKobo) {
      drifts.push({
        partnerId: partner.id,
        partnerName: partner.fullName,
        virtualAccountNumber: partner.virtualAccountNumber,
        nombaTransactionId: txId,
        sessionId: String(tx.sessionId ?? ""),
        amountNaira,
        issue: "amount_mismatch",
        localPaymentId: local.id,
      });
    }
  }

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

  return {
    drifts,
    nombaCount: nombaRows.length,
    localCount: localPayments.length,
    syncedAt: new Date().toISOString(),
  };
}
