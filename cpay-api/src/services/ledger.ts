import { Op } from "sequelize";
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

/** First month the member pledged to start paying (not necessarily when the account was created). */
export function getPartnershipStart(partner: Partner): Date {
  const joined = partner.joinedAt ? new Date(partner.joinedAt) : new Date();
  const year = partner.partnershipStartYear ?? joined.getFullYear();
  const month = (partner.partnershipStartMonth ?? joined.getMonth() + 1) - 1;
  return new Date(year, month, 1);
}

export function formatPartnershipStartLabel(partner: Partner): string {
  const start = getPartnershipStart(partner);
  return start.toLocaleString("en-NG", { month: "short", year: "numeric" });
}

function isBeforePartnershipStart(
  year: number,
  month: number,
  partner: Partner
): boolean {
  const start = getPartnershipStart(partner);
  const sy = start.getFullYear();
  const sm = start.getMonth() + 1;
  return year < sy || (year === sy && month < sm);
}

/** Months eligible when finance applies an overpayment forward (after pledge start, not current month). */
function isEligibleForForwardCredit(
  year: number,
  month: number,
  partner: Partner
): boolean {
  if (isBeforePartnershipStart(year, month, partner)) return false;

  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const start = getPartnershipStart(partner);
  const partnershipBeginsInFuture =
    start > new Date(cy, cm - 1, 1);

  if (partnershipBeginsInFuture) {
    return year > cy || (year === cy && month >= (partner.partnershipStartMonth ?? cm));
  }

  return year > cy || (year === cy && month > cm);
}

export async function ensurePartnerMonths(partner: Partner): Promise<void> {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const trackingStart = getPartnershipStart(partner);

  const sy = trackingStart.getFullYear();
  const sm = trackingStart.getMonth() + 1;
  await PartnerMonth.destroy({
    where: {
      partnerId: partner.id,
      [Op.or]: [
        { year: { [Op.lt]: sy } },
        { year: sy, month: { [Op.lt]: sm } },
      ],
    },
  });

  let cursor = new Date(trackingStart.getFullYear(), trackingStart.getMonth(), 1);

  if (cursor > end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    await PartnerMonth.findOrCreate({
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
    await refreshMissedMonths(partner.id);
    return;
  }

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

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleString("en-NG", {
    month: "short",
    year: "numeric",
  });
}

/** Add one partnership month row immediately after the latest existing row (or next calendar month). */
async function ensureMonthAfterLatest(partner: Partner): Promise<PartnerMonth> {
  const latest = await PartnerMonth.findOne({
    where: { partnerId: partner.id },
    order: [
      ["year", "DESC"],
      ["month", "DESC"],
    ],
  });

  const cursor = latest
    ? new Date(latest.year, latest.month, 1)
    : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

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

  return row;
}

function isAfterCurrentMonth(year: number, month: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month > currentMonth);
}

/** First unpaid month strictly after the current calendar month. */
async function ensureEarliestUnpaidFutureMonth(partner: Partner): Promise<PartnerMonth> {
  const now = new Date();
  const start = getPartnershipStart(partner);
  const nextCalendar = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let cursor = start > new Date(now.getFullYear(), now.getMonth(), 1) ? start : nextCalendar;
  if (cursor < start) cursor = start;

  while (true) {
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

    if (row.paidKobo < row.expectedKobo) return row;

    cursor = new Date(year, month, 1);
  }
}

/**
 * Spread kobo across earliest unpaid month(s), creating future month rows as needed.
 * With startAfterCurrentMonth: skips current/past months (₦100 → Jul + Aug at ₦50/mo).
 */
async function applyKoboAcrossMonths(
  partner: Partner,
  amountKobo: number,
  options?: { startAfterCurrentMonth?: boolean }
): Promise<{
  appliedKobo: number;
  remainingKobo: number;
  prepaidLabels: string[];
}> {
  await ensurePartnerMonths(partner);

  let remaining = amountKobo;
  let applied = 0;
  const prepaidLabels: string[] = [];
  const maxPasses =
    Math.ceil(amountKobo / Math.max(partner.monthlyCommitmentKobo, 1)) + 2;
  let passes = 0;

  while (remaining > 0 && passes < maxPasses) {
    passes += 1;
    const months = await PartnerMonth.findAll({
      where: { partnerId: partner.id },
      order: [
        ["year", "ASC"],
        ["month", "ASC"],
      ],
    });

    let appliedThisPass = false;

    for (const row of months) {
      if (
        options?.startAfterCurrentMonth &&
        !isEligibleForForwardCredit(row.year, row.month, partner)
      ) {
        continue;
      }

      const due = row.expectedKobo - row.paidKobo;
      if (due <= 0) continue;
      if (remaining <= 0) break;

      const slice = Math.min(remaining, due);
      const wasUnpaid = row.paidKobo === 0;
      row.paidKobo += slice;
      remaining -= slice;
      applied += slice;
      appliedThisPass = true;
      await row.save();

      if (wasUnpaid && row.paidKobo >= row.expectedKobo) {
        prepaidLabels.push(monthLabel(row.year, row.month));
      }
    }

    if (remaining > 0 && !appliedThisPass) {
      if (options?.startAfterCurrentMonth) {
        await ensureEarliestUnpaidFutureMonth(partner);
      } else {
        await ensureMonthAfterLatest(partner);
      }
      continue;
    }

    if (!appliedThisPass) break;
  }

  return { appliedKobo: applied, remainingKobo: remaining, prepaidLabels };
}

/** Apply kobo only to month rows that already exist (webhook path — excess stays for finance). */
async function applyKoboToExistingMonths(
  partner: Partner,
  amountKobo: number
): Promise<{ remainingKobo: number; monthsFullyCovered: number }> {
  await ensurePartnerMonths(partner);

  let remaining = amountKobo;
  let monthsFullyCovered = 0;

  const months = await PartnerMonth.findAll({
    where: { partnerId: partner.id },
    order: [
      ["year", "ASC"],
      ["month", "ASC"],
    ],
  });

  for (const row of months) {
    if (isBeforePartnershipStart(row.year, row.month, partner)) continue;

    const due = row.expectedKobo - row.paidKobo;
    if (due <= 0) continue;
    if (remaining <= 0) break;

    const wasUnpaid = row.paidKobo < row.expectedKobo;
    const slice = Math.min(remaining, due);
    row.paidKobo += slice;
    remaining -= slice;
    await row.save();

    if (wasUnpaid && row.paidKobo >= row.expectedKobo) {
      monthsFullyCovered += 1;
    }
  }

  return { remainingKobo: remaining, monthsFullyCovered };
}

/** Rebuild ledger from all payments except one (used when re-allocating an overpayment). */
export async function rebuildPartnerLedgerExcluding(
  partnerId: string,
  excludePaymentId: string
): Promise<void> {
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
    if (payment.id === excludePaymentId) continue;
    await applyPaymentToLedger(partnerId, payment.amountKobo);
  }

  if (payments.filter((p) => p.id !== excludePaymentId).length === 0) {
    await ensurePartnerMonths(partner);
  }
}

/**
 * Re-allocate a full overpayment to future months only (Jul + Aug for ₦100 at ₦50/mo).
 */
export async function applyOverpaymentToFutureMonths(
  partnerId: string,
  paymentId: string
): Promise<{
  appliedKobo: number;
  remainingCreditKobo: number;
  prepaidLabels: string[];
}> {
  const partner = await Partner.findByPk(partnerId);
  const payment = await Payment.findByPk(paymentId);
  if (!partner || !payment) throw new Error("Partner or payment not found");

  await rebuildPartnerLedgerExcluding(partnerId, paymentId);

  const result = await applyKoboAcrossMonths(partner, payment.amountKobo, {
    startAfterCurrentMonth: true,
  });

  partner.creditBalanceKobo = result.remainingKobo;
  await partner.save();
  await refreshMissedMonths(partnerId);

  return {
    appliedKobo: result.appliedKobo,
    remainingCreditKobo: result.remainingKobo,
    prepaidLabels: result.prepaidLabels,
  };
}

/**
 * Apply stored credit balance to unpaid month(s), creating future rows as needed.
 * Called when finance chooses "apply to next month" on an overpayment.
 */
export async function applyStoredCreditToLedger(partnerId: string): Promise<{
  appliedKobo: number;
  remainingCreditKobo: number;
  prepaidLabels: string[];
}> {
  const partner = await Partner.findByPk(partnerId);
  if (!partner) throw new Error("Partner not found");

  const creditKobo = partner.creditBalanceKobo ?? 0;
  if (creditKobo <= 0) {
    return { appliedKobo: 0, remainingCreditKobo: 0, prepaidLabels: [] };
  }

  partner.creditBalanceKobo = 0;
  await partner.save();

  const result = await applyKoboAcrossMonths(partner, creditKobo);

  partner.creditBalanceKobo = result.remainingKobo;
  await partner.save();
  await refreshMissedMonths(partnerId);

  return {
    appliedKobo: result.appliedKobo,
    remainingCreditKobo: result.remainingKobo,
    prepaidLabels: result.prepaidLabels,
  };
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

  const totalKobo = amountKobo + (partner.creditBalanceKobo ?? 0);
  partner.creditBalanceKobo = 0;
  await partner.save();

  const { remainingKobo: remaining, monthsFullyCovered } =
    await applyKoboToExistingMonths(partner, totalKobo);

  await refreshMissedMonths(partnerId);

  const afterMonths = await PartnerMonth.findAll({ where: { partnerId } });
  const unpaid = afterMonths.filter((m) => m.paidKobo < m.expectedKobo);
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
