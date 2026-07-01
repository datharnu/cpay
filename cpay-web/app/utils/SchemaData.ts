import { z } from "zod";

export const createPartnerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Enter a valid phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  monthlyCommitment: z.number().positive("Amount must be greater than 0"),
  partnershipStartMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick the month they plan to start paying"),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;

function defaultPartnershipStartMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export { defaultPartnershipStartMonth };
