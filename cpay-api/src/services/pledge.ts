import { Partner, Payment } from "../models";

function koboToNaira(kobo: number): number {
  return kobo / 100;
}

function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(koboToNaira(kobo));
}

export const COMMITMENT_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "bimonthly",
  "semiannual",
  "one_off",
] as const;

export type CommitmentFrequency = (typeof COMMITMENT_FREQUENCIES)[number];

export function isCommitmentFrequency(value: string): value is CommitmentFrequency {
  return (COMMITMENT_FREQUENCIES as readonly string[]).includes(value);
}

/** How often they pay — plain words for the UI. */
export function frequencyLabel(frequency: string | null | undefined): string {
  switch (frequency) {
    case "weekly":
      return "every week";
    case "biweekly":
      return "every 2 weeks";
    case "monthly":
      return "every month";
    case "bimonthly":
      return "every 2 months";
    case "semiannual":
      return "every 6 months";
    case "one_off":
      return "one-time payment";
    default:
      return "every month";
  }
}

export function frequencyShortLabel(frequency: string | null | undefined): string {
  switch (frequency) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "bimonthly":
      return "Every 2 months";
    case "semiannual":
      return "Every 6 months";
    case "one_off":
      return "One-time";
    default:
      return "Monthly";
  }
}

export function installmentAmountKobo(
  pledgeTotalKobo: number,
  installmentCount: number
): number {
  const count = Math.max(1, installmentCount);
  return Math.round(pledgeTotalKobo / count);
}

/**
 * How much this member is expected to cover in a normal calendar month.
 * Used by the monthly ledger / dashboard.
 */
export function expectedPerMonthKobo(partner: Partner): number {
  const installment = partner.monthlyCommitmentKobo;
  if (installment <= 0) return 0;

  switch (partner.commitmentFrequency) {
    case "weekly":
      return installment * 4;
    case "biweekly":
      return installment * 2;
    case "monthly":
      return installment;
    case "bimonthly":
      return Math.round(installment / 2);
    case "semiannual":
      return Math.round(installment / 6);
    case "one_off":
      return installment;
    default:
      return installment;
  }
}

/** Month ledger target — 0 once the full pledge is paid. */
export async function ledgerMonthExpectedKobo(partner: Partner): Promise<number> {
  const payments = await Payment.findAll({ where: { partnerId: partner.id } });
  const paidKobo = payments
    .filter((p) => p.classification !== "unmatched")
    .reduce((sum, p) => sum + p.amountKobo, 0);

  const pledgeTotalKobo =
    partner.pledgeTotalKobo > 0
      ? partner.pledgeTotalKobo
      : partner.monthlyCommitmentKobo * Math.max(1, partner.installmentCount || 1);

  if (pledgeTotalKobo > 0 && paidKobo >= pledgeTotalKobo) return 0;
  return expectedPerMonthKobo(partner);
}

export function planSummary(partner: Partner): string {
  const installment = formatNaira(partner.monthlyCommitmentKobo);
  const total = formatNaira(partner.pledgeTotalKobo || partner.monthlyCommitmentKobo);
  const count = partner.installmentCount || 1;
  const freq = frequencyLabel(partner.commitmentFrequency);

  if (partner.commitmentFrequency === "one_off" || count === 1) {
    return `${total} as a one-time payment`;
  }

  return `${installment} ${freq} · ${count} payments · ${total} total`;
}

export async function getPledgeProgress(partner: Partner): Promise<{
  pledgeTotal: number;
  installmentAmount: number;
  installmentCount: number;
  frequency: string;
  frequencyLabel: string;
  frequencyShortLabel: string;
  planSummary: string;
  paidTowardPledge: number;
  remainingPledge: number;
  progressPercent: number;
  pledgeComplete: boolean;
  expectedThisMonth: number;
}> {
  const payments = await Payment.findAll({
    where: { partnerId: partner.id },
  });

  const paidKobo = payments
    .filter((p) => p.classification !== "unmatched")
    .reduce((sum, p) => sum + p.amountKobo, 0);

  const pledgeTotalKobo =
    partner.pledgeTotalKobo > 0
      ? partner.pledgeTotalKobo
      : partner.monthlyCommitmentKobo * Math.max(1, partner.installmentCount || 1);

  const remainingKobo = Math.max(0, pledgeTotalKobo - paidKobo);
  const progressPercent =
    pledgeTotalKobo > 0
      ? Math.min(100, Math.round((paidKobo / pledgeTotalKobo) * 100))
      : 0;
  const pledgeComplete = remainingKobo <= 0 && pledgeTotalKobo > 0;

  return {
    pledgeTotal: koboToNaira(pledgeTotalKobo),
    installmentAmount: koboToNaira(partner.monthlyCommitmentKobo),
    installmentCount: partner.installmentCount || 1,
    frequency: partner.commitmentFrequency || "monthly",
    frequencyLabel: frequencyLabel(partner.commitmentFrequency),
    frequencyShortLabel: frequencyShortLabel(partner.commitmentFrequency),
    planSummary: planSummary(partner),
    paidTowardPledge: koboToNaira(paidKobo),
    remainingPledge: koboToNaira(remainingKobo),
    progressPercent,
    pledgeComplete,
    expectedThisMonth: pledgeComplete ? 0 : koboToNaira(expectedPerMonthKobo(partner)),
  };
}

/** Ensure pledge columns exist on older SQLite databases. */
export async function ensurePledgeColumns(): Promise<void> {
  const [rows] = await Partner.sequelize!.query("PRAGMA table_info(partners);");
  const columns = new Set(
    (rows as Array<{ name: string }>).map((row) => row.name)
  );

  if (!columns.has("pledgeTotalKobo")) {
    await Partner.sequelize!.query(
      "ALTER TABLE partners ADD COLUMN pledgeTotalKobo INTEGER NOT NULL DEFAULT 0;"
    );
  }
  if (!columns.has("commitmentFrequency")) {
    await Partner.sequelize!.query(
      "ALTER TABLE partners ADD COLUMN commitmentFrequency VARCHAR(32) NOT NULL DEFAULT 'monthly';"
    );
  }
  if (!columns.has("installmentCount")) {
    await Partner.sequelize!.query(
      "ALTER TABLE partners ADD COLUMN installmentCount INTEGER NOT NULL DEFAULT 12;"
    );
  }
}

/** Fill pledge fields for older partners that only had a monthly amount. */
export async function backfillPartnerPledges(): Promise<number> {
  await ensurePledgeColumns();

  const partners = await Partner.findAll();
  let updated = 0;

  for (const partner of partners) {
    const needsTotal = !partner.pledgeTotalKobo || partner.pledgeTotalKobo <= 0;
    const needsCount = !partner.installmentCount || partner.installmentCount <= 0;
    const needsFrequency = !partner.commitmentFrequency;

    if (!needsTotal && !needsCount && !needsFrequency) continue;

    if (needsFrequency) partner.commitmentFrequency = "monthly";
    if (needsCount) partner.installmentCount = 12;
    if (needsTotal) {
      partner.pledgeTotalKobo =
        partner.monthlyCommitmentKobo * Math.max(1, partner.installmentCount);
    }
    await partner.save();
    updated += 1;
  }

  return updated;
}
