import { z } from "zod";

export const COMMITMENT_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "bimonthly",
  "semiannual",
  "one_off",
] as const;

export type CommitmentFrequency = (typeof COMMITMENT_FREQUENCIES)[number];

export const FREQUENCY_OPTIONS: Array<{
  value: CommitmentFrequency;
  label: string;
  hint: string;
}> = [
  { value: "weekly", label: "Every week", hint: "Weekly payments" },
  { value: "biweekly", label: "Every 2 weeks", hint: "Twice a month" },
  { value: "monthly", label: "Every month", hint: "Monthly payments" },
  { value: "bimonthly", label: "Every 2 months", hint: "Once every two months" },
  { value: "semiannual", label: "Every 6 months", hint: "Twice a year" },
  { value: "one_off", label: "One-time payment", hint: "Pay everything at once" },
];

export const createPartnerSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    phone: z.string().min(10, "Enter a valid phone number"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    pledgeTotal: z.number().positive("Enter the full amount they agreed to give"),
    frequency: z.enum(COMMITMENT_FREQUENCIES, {
      message: "Pick how often they will pay",
    }),
    installmentCount: z
      .number()
      .int("Use a whole number")
      .min(1, "At least 1 payment")
      .max(520, "Too many payments"),
    partnershipStartMonth: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick the month they plan to start paying"),
  })
  .superRefine((values, ctx) => {
    if (values.frequency === "one_off" && values.installmentCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["installmentCount"],
        message: "One-time payments use 1 installment",
      });
    }
  });

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;

export function installmentAmountNaira(
  pledgeTotal: number,
  installmentCount: number
): number {
  const count = Math.max(1, installmentCount || 1);
  if (!Number.isFinite(pledgeTotal) || pledgeTotal <= 0) return 0;
  return Math.round((pledgeTotal / count) * 100) / 100;
}

export function planHelperText(input: {
  pledgeTotal: number;
  frequency: CommitmentFrequency;
  installmentCount: number;
}): string {
  const count =
    input.frequency === "one_off" ? 1 : Math.max(1, input.installmentCount || 1);
  const each = installmentAmountNaira(input.pledgeTotal, count);
  if (!each) return "Enter the total amount and how they will pay.";

  const money = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(each);

  const total = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(input.pledgeTotal);

  if (input.frequency === "one_off" || count === 1) {
    return `They will pay ${total} once.`;
  }

  const when =
    FREQUENCY_OPTIONS.find((option) => option.value === input.frequency)?.label.toLowerCase() ??
    "on schedule";

  return `That is ${money} ${when}, for ${count} payments (${total} in total).`;
}

function defaultPartnershipStartMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export { defaultPartnershipStartMonth };
