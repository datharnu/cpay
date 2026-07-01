import { Op } from "sequelize";
import {
  OverpaymentCase,
  Partner,
  PartnerNotification,
} from "../models";

export async function markPartnerNotificationsRead(
  partnerId: string,
  opts?: {
    paymentId?: string | null;
    types?: PartnerNotification["type"][];
  }
): Promise<number> {
  const where: Record<string, unknown> = {
    partnerId,
    read: false,
  };

  if (opts?.paymentId) {
    where.paymentId = opts.paymentId;
  }

  if (opts?.types?.length) {
    where.type = { [Op.in]: opts.types };
  }

  const [count] = await PartnerNotification.update(
    { read: true },
    { where }
  );

  return count;
}

/** Mark stale overpayment alerts read when the case is no longer pending. */
export async function reconcileNotificationReadState(): Promise<void> {
  const pendingAlerts = await PartnerNotification.findAll({
    where: {
      read: false,
      type: "overpayment_pending",
    },
  });

  for (const alert of pendingAlerts) {
    const where: Record<string, unknown> = {
      partnerId: alert.partnerId,
      status: { [Op.in]: ["pending_choice", "refund_pending"] },
    };
    if (alert.paymentId) {
      where.paymentId = alert.paymentId;
    }

    const openCase = await OverpaymentCase.findOne({ where });

    if (!openCase) {
      alert.read = true;
      await alert.save();
    }
  }
}

export function mapNotificationRow(
  n: PartnerNotification,
  partner?: Partner | null
) {
  return {
    id: n.id,
    partnerId: n.partnerId,
    partnerName: partner?.fullName ?? "Unknown member",
    paymentId: n.paymentId,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: (n as PartnerNotification & { createdAt?: Date }).createdAt ?? null,
  };
}
