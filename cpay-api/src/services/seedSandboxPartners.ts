import { Partner } from "../models";
import { ensurePartnerMonths, nairaToKobo } from "./ledger";

const SANDBOX_PARTNERS = [
  {
    fullName: "Sister Grace Adeyemi",
    phone: "08012345678",
    email: "grace@church.org",
    monthlyCommitmentKobo: nairaToKobo(50),
    pledgeTotalKobo: nairaToKobo(600),
    commitmentFrequency: "monthly" as const,
    installmentCount: 12,
    accountRef: "cpay_grace_sandbox",
    virtualAccountNumber: "6087240289",
    bankName: "Nombank MFB",
    bankAccountName: "Nomba/Sister Grace Partnership",
  },
  {
    fullName: "Brother Ade Okafor",
    phone: "08098765432",
    email: "ade@church.org",
    monthlyCommitmentKobo: nairaToKobo(100),
    pledgeTotalKobo: nairaToKobo(1200),
    commitmentFrequency: "monthly" as const,
    installmentCount: 12,
    accountRef: "cpay_ade_sandbox",
    virtualAccountNumber: "5903473362",
    bankName: "Nombank MFB",
    bankAccountName: "Nomba/Brother Ade Partnership",
  },
] as const;

export async function seedSandboxPartnersIfEmpty(): Promise<boolean> {
  // Never auto-seed fixed demo VAs on live Nomba — that re-attaches old test accounts.
  const baseUrl = process.env.NOMBA_BASE_URL ?? "";
  if (baseUrl.includes("api.nomba.com")) {
    console.log("[boot] Live Nomba — skipping auto-seed of demo partners.");
    return false;
  }

  const count = await Partner.count();
  if (count > 0) return false;

  for (const row of SANDBOX_PARTNERS) {
    const partner = await Partner.create({ ...row, status: "active" });
    await ensurePartnerMonths(partner);
  }

  console.log(`Seeded ${SANDBOX_PARTNERS.length} sandbox partners (existing Nomba VAs).`);
  return true;
}
