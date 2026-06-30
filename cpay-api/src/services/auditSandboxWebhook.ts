import { env } from "../config/env";
import { Partner } from "../models";
import { fetchVirtualAccount } from "./nombaClient";

/** Warn on boot when Nomba VAs are not wired to the live webhook URL. */
export async function auditSandboxWebhookSetup(): Promise<void> {
  const expected = env.nomba.webhookUrl;
  if (!expected) {
    console.warn(
      "[webhook audit] WEBHOOK_URL is not set — Nomba cannot notify CPay of transfers."
    );
    return;
  }

  console.log(`[webhook audit] Expecting Nomba callbacks at ${expected}`);
  console.log(
    `[webhook audit] Hackathon form must use the same URL + sub-account ${env.nomba.subAccountId}`
  );

  const partners = await Partner.findAll();
  for (const partner of partners) {
    if (!partner.virtualAccountNumber) continue;

    try {
      const nomba = await fetchVirtualAccount(partner.virtualAccountNumber);
      const callback = (nomba.data as { callbackUrl?: string })?.callbackUrl;

      if (!callback) {
        console.warn(
          `[webhook audit] ${partner.fullName} (${partner.virtualAccountNumber}) has NO per-VA callbackUrl on Nomba — relies on hackathon form webhook URL only.`
        );
      } else if (callback !== expected) {
        console.warn(
          `[webhook audit] ${partner.fullName} (${partner.virtualAccountNumber}) callbackUrl is ${callback} — NOT ${expected}`
        );
      } else {
        console.log(
          `[webhook audit] ${partner.fullName} (${partner.virtualAccountNumber}) callbackUrl OK`
        );
      }
    } catch (err) {
      console.warn(
        `[webhook audit] Could not verify ${partner.fullName} VA on Nomba:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
