import { env } from "../config/env";
import { Partner } from "../models";
import { fetchVirtualAccount, updateVirtualAccount } from "./nombaClient";

export type WebhookSyncResult = {
  partnerId: string;
  partnerName: string;
  virtualAccountNumber: string;
  status: "ok" | "updated" | "skipped" | "failed";
  previousCallbackUrl?: string;
  message?: string;
};

/** Point each partner VA at WEBHOOK_URL so Nomba notifies CPay after bank transfers. */
export async function syncPartnerVirtualAccountWebhooks(): Promise<WebhookSyncResult[]> {
  const expected = env.nomba.webhookUrl;
  if (!expected) {
    console.warn(
      "[webhook sync] WEBHOOK_URL is not set — skipping VA callback updates."
    );
    return [];
  }

  console.log(`[webhook sync] Target callback URL: ${expected}`);

  const partners = await Partner.findAll();
  const results: WebhookSyncResult[] = [];

  for (const partner of partners) {
    if (!partner.virtualAccountNumber) continue;

    const base: WebhookSyncResult = {
      partnerId: partner.id,
      partnerName: partner.fullName,
      virtualAccountNumber: partner.virtualAccountNumber,
      status: "ok",
    };

    try {
      const nomba = await fetchVirtualAccount(partner.virtualAccountNumber);
      const callback = (nomba.data as { callbackUrl?: string })?.callbackUrl;

      if (!callback) {
        console.warn(
          `[webhook sync] ${partner.fullName} (${partner.virtualAccountNumber}) has no callbackUrl — updating to ${expected}`
        );
      } else if (callback === expected) {
        console.log(
          `[webhook sync] ${partner.fullName} (${partner.virtualAccountNumber}) callbackUrl OK`
        );
        results.push({ ...base, status: "ok", previousCallbackUrl: callback });
        continue;
      } else {
        console.warn(
          `[webhook sync] ${partner.fullName} (${partner.virtualAccountNumber}) callbackUrl was ${callback} — updating`
        );
      }

      await updateVirtualAccount(partner.virtualAccountNumber, {
        callbackUrl: expected,
      });

      results.push({
        ...base,
        status: "updated",
        previousCallbackUrl: callback,
      });
      console.log(
        `[webhook sync] Updated ${partner.fullName} (${partner.virtualAccountNumber}) → ${expected}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[webhook sync] Failed for ${partner.fullName} (${partner.virtualAccountNumber}):`,
        message
      );
      results.push({ ...base, status: "failed", message });
    }
  }

  return results;
}
