import { z } from "zod";

export const createPartnerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Enter a valid phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  monthlyCommitment: z.number().positive("Amount must be greater than 0"),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
