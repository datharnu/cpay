import {
  OverpaymentCase,
  Partner,
  PartnerMonth,
  PartnerNotification,
  Payment,
  WebhookEvent,
} from "../models";
import { expireVirtualAccount } from "./nombaClient";

export type ResetCleanDemoResult = {
  partnersRemoved: number;
  paymentsRemoved: number;
  overpaymentsRemoved: number;
  monthsRemoved: number;
  notificationsRemoved: number;
  webhookEventsRemoved: number;
  vasExpired: string[];
  vaExpireErrors: string[];
};

/**
 * Full clean slate for a fresh demo:
 * - expire every partner VA on Nomba
 * - wipe all CPay local data
 * Does not touch Nomba wallet balance or credentials.
 */
export async function resetCleanDemo(): Promise<ResetCleanDemoResult> {
  const partners = await Partner.findAll();
  const vasExpired: string[] = [];
  const vaExpireErrors: string[] = [];

  for (const partner of partners) {
    const va = partner.virtualAccountNumber;
    if (!va) continue;

    try {
      await expireVirtualAccount(va);
      vasExpired.push(va);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "expire failed";
      if (/expir|already|not found|404/i.test(detail)) {
        vasExpired.push(va);
      } else {
        vaExpireErrors.push(`${va}: ${detail}`);
      }
    }
  }

  const notificationsRemoved = await PartnerNotification.destroy({ where: {} });
  const overpaymentsRemoved = await OverpaymentCase.destroy({ where: {} });
  const monthsRemoved = await PartnerMonth.destroy({ where: {} });
  const paymentsRemoved = await Payment.destroy({ where: {} });
  const webhookEventsRemoved = await WebhookEvent.destroy({ where: {} });
  const partnersRemoved = await Partner.destroy({ where: {} });

  return {
    partnersRemoved,
    paymentsRemoved,
    overpaymentsRemoved,
    monthsRemoved,
    notificationsRemoved,
    webhookEventsRemoved,
    vasExpired,
    vaExpireErrors,
  };
}
