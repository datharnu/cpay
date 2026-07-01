import { Op } from "sequelize";
import { Partner, Payment } from "../models";
import { nairaToKobo } from "./ledger";
import {
  fetchSubAccountTransactions,
  fetchVirtualAccount,
} from "./nombaClient";

export type ReconciliationDrift = {
  partnerId?: string;
  partnerName?: string;
  virtualAccountNumber?: string;
  nombaTransactionId?: string;
  sessionId?: string;
  amountNaira: number;
  senderName?: string | null;
  timeCreated?: string | null;
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

function isInboundVaCredit(tx: Record<string, unknown>): boolean {
  if (tx.status !== "SUCCESS") return false;
  if (tx.entryType && tx.entryType !== "CREDIT") return false;

  const type = String(tx.type ?? tx.transactionType ?? "");
  if (type && type !== "vact_transfer") return false;

  return true;
}

function findPartnerVaInTx(
  partnerVas: Map<string, Partner>,
  tx: Record<string, unknown>
): Partner | null {
  const recipient = String(tx.recipientAccountNumber ?? "");
  if (recipient && partnerVas.has(recipient)) {
    return partnerVas.get(recipient) ?? null;
  }

  const direct = String(
    tx.aliasAccountNumber ??
      tx.bankAccountNumber ??
      tx.virtualAccountNumber ??
      ""
  );
  if (direct && partnerVas.has(direct)) {
    return partnerVas.get(direct) ?? null;
  }

  const blob = JSON.stringify(tx);
  for (const [va, partner] of partnerVas) {
    if (blob.includes(va)) return partner;
  }

  return null;
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

  const { data } = await fetchSubAccountTransactions();
  const rows = (data?.results ?? []).filter((tx) => {
    if (!isInboundVaCredit(tx as Record<string, unknown>)) return false;
    return (
      tx.recipientAccountNumber === partner.virtualAccountNumber ||
      JSON.stringify(tx).includes(partner.virtualAccountNumber!)
    );
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
    const { data } = await fetchSubAccountTransactions();
    nombaRows = (data?.results ?? []) as Array<Record<string, unknown>>;
  } catch (err) {
    console.warn("Reconcile: could not fetch Nomba sub-account transactions:", err);
  }

  for (const tx of nombaRows) {
    if (!isInboundVaCredit(tx)) continue;

    const partner = findPartnerVaInTx(partnerVas, tx);
    if (!partner?.virtualAccountNumber) continue;

    const txId = String(tx.id ?? tx.transactionId ?? tx.sessionId ?? "");
    if (!txId) continue;
    seenNombaIds.add(txId);

    const amountNaira = parseNombaTxAmountNaira(
      tx.transactionAmount ?? tx.amount
    );
    if (amountNaira <= 0) continue;

    const local = localPayments.find(
      (p) =>
        p.nombaTransactionId === tx.id ||
        p.nombaTransactionId === tx.transactionId ||
        (tx.sessionId && p.sessionId === tx.sessionId) ||
        p.nombaTransactionId === txId
    );

    const amountKobo = nairaToKobo(amountNaira);
    const senderName = String(
      tx.senderName ?? tx.ktaSenderName ?? ""
    ).trim() || null;
    const timeCreated = String(tx.timeCreated ?? "") || null;

    if (!local) {
      drifts.push({
        partnerId: partner.id,
        partnerName: partner.fullName,
        virtualAccountNumber: partner.virtualAccountNumber,
        nombaTransactionId: txId,
        sessionId: String(tx.sessionId ?? ""),
        amountNaira,
        senderName,
        timeCreated,
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
        senderName,
        timeCreated,
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
    nombaCount: nombaRows.filter((tx) => isInboundVaCredit(tx)).length,
    localCount: localPayments.length,
    syncedAt: new Date().toISOString(),
  };
}
