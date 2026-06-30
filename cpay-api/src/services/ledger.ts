import { Partner, PartnerMonth, Payment } from "../models";

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(koboToNaira(kobo));
}

export async function ensurePartnerMonths(partner: Partner): Promise<void> {
  const paymentCount = await Payment.count({ where: { partnerId: partner.id } });
  const now = new Date();

  // Before any webhook payment: track current month only (no retroactive "missed" months).
  const trackingStart =
    paymentCount === 0
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(partner.joinedAt);

  let cursor = new Date(trackingStart.getFullYear(), trackingStart.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;

    const [row] = await PartnerMonth.findOrCreate({
      where: { partnerId: partner.id, year, month },
      defaults: {
        partnerId: partner.id,
        year,
        month,
        expectedKobo: partner.monthlyCommitmentKobo,
        paidKobo: 0,
        status: "pending",
      },
    });

    if (row.expectedKobo !== partner.monthlyCommitmentKobo) {
      row.expectedKobo = partner.monthlyCommitmentKobo;
      await row.save();
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  await refreshMissedMonths(partner.id);
}

async function refreshMissedMonths(partnerId: string): Promise<void> {
  const paymentCount = await Payment.count({ where: { partnerId } });
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const months = await PartnerMonth.findAll({
    where: { partnerId },
    order: [
      ["year", "ASC"],
      ["month", "ASC"],
    ],
  });

  for (const row of months) {
    const isPast =
      row.year < currentYear ||
      (row.year === currentYear && row.month < currentMonth);

    if (row.paidKobo >= row.expectedKobo) {
      row.status = "paid";
    } else if (row.paidKobo > 0) {
      row.status = "partial";
    } else if (isPast && paymentCount > 0) {
      row.status = "missed";
    } else {
      row.status = "pending";
    }
    await row.save();
  }
}

/** Rebuild month rows and balances purely from recorded webhook payments. */
export async function rebuildPartnerLedger(partnerId: string): Promise<void> {
  const partner = await Partner.findByPk(partnerId);
  if (!partner) return;

  await PartnerMonth.destroy({ where: { partnerId } });
  partner.creditBalanceKobo = 0;
  await partner.save();

  const payments = await Payment.findAll({
    where: { partnerId },
    order: [["createdAt", "ASC"]],
  });

  for (const payment of payments) {
    await applyPaymentToLedger(partnerId, payment.amountKobo);
  }

  if (payments.length === 0) {
    await ensurePartnerMonths(partner);
  }
}

export async function applyPaymentToLedger(
  partnerId: string,
  amountKobo: number
): Promise<{
  classification: "exact" | "under" | "over" | "catch_up";
  excessKobo: number;
}> {
  const partner = await Partner.findByPk(partnerId);
  if (!partner) throw new Error("Partner not found");

  await ensurePartnerMonths(partner);

  let remaining = amountKobo + (partner.creditBalanceKobo ?? 0);
  partner.creditBalanceKobo = 0;

  const months = await PartnerMonth.findAll({
    where: { partnerId },
    order: [
      ["year", "ASC"],
      ["month", "ASC"],
    ],
  });

  let monthsFullyCovered = 0;

  for (const row of months) {
    const due = row.expectedKobo - row.paidKobo;
    if (due <= 0) continue;
    if (remaining <= 0) break;

    const applied = Math.min(remaining, due);
    row.paidKobo += applied;
    remaining -= applied;
    await row.save();

    if (row.paidKobo >= row.expectedKobo) {
      monthsFullyCovered += 1;
    }
  }

  await partner.save();
  await refreshMissedMonths(partnerId);

  const unpaid = months.filter((m) => m.paidKobo < m.expectedKobo);
  const excessKobo = remaining;

  if (excessKobo > 0 && monthsFullyCovered > 1) {
    return { classification: "catch_up", excessKobo };
  }
  if (unpaid.length === 0 && excessKobo > 0) {
    return { classification: "over", excessKobo };
  }
  if (excessKobo > 0) {
    return { classification: "over", excessKobo };
  }
  if (amountKobo < partner.monthlyCommitmentKobo && monthsFullyCovered === 0) {
    return { classification: "under", excessKobo: 0 };
  }
  return { classification: "exact", excessKobo: 0 };
}

export async function getPartnerSummary(partnerId: string) {
  const partner = await Partner.findByPk(partnerId, {
    include: [{ model: PartnerMonth, as: "months" }],
  });
  if (!partner) return null;

  const months = (partner as Partner & { months?: PartnerMonth[] }).months ?? [];
  const arrearsKobo = months
    .filter((m) => m.status === "missed" || m.status === "partial")
    .reduce((sum, m) => sum + Math.max(0, m.expectedKobo - m.paidKobo), 0);

  return {
    partner,
    arrearsKobo,
    monthsPaid: months.filter((m) => m.status === "paid").length,
    monthsMissed: months.filter((m) => m.status === "missed").length,
  };
}
