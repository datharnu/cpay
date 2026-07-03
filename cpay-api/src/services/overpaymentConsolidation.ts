import { Op } from "sequelize";
import { OverpaymentCase, Partner, Payment } from "../models";
import { markPartnerNotificationsRead } from "./notifications";

export const OPEN_OVERPAYMENT_STATUSES = ["pending_choice", "refund_pending"] as const;

export async function findDuplicatePayment(opts: {
  nombaTransactionId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
}): Promise<Payment | null> {
  const clauses: Record<string, string>[] = [];

  if (opts.nombaTransactionId) {
    clauses.push({ nombaTransactionId: opts.nombaTransactionId });
  }
  if (opts.sessionId) {
    clauses.push({ sessionId: opts.sessionId });
  }
  if (opts.requestId) {
    clauses.push({ requestId: opts.requestId });
  }

  if (clauses.length === 0) return null;

  return Payment.findOne({ where: { [Op.or]: clauses } });
}

/** Only one open overpayment alert per member at a time. */
export async function shouldCreateOverpaymentCase(
  partnerId: string,
  paymentId: string
): Promise<boolean> {
  const existing = await OverpaymentCase.findOne({ where: { paymentId } });
  if (existing) return false;

  const payment = await Payment.findByPk(paymentId);
  if (payment?.nombaTransactionId) {
    const duplicateCase = await OverpaymentCase.findOne({
      include: [
        {
          model: Payment,
          as: "payment",
          where: { nombaTransactionId: payment.nombaTransactionId },
          required: true,
        },
      ],
    });
    if (duplicateCase) return false;
  }

  const openPending = await OverpaymentCase.count({
    where: { partnerId, status: "pending_choice" },
  });

  return openPending === 0;
}

async function dismissOverpaymentCase(row: OverpaymentCase): Promise<void> {
  row.status = "dismissed";
  row.resolvedAt = new Date();
  await row.save();

  await markPartnerNotificationsRead(row.partnerId, {
    paymentId: row.paymentId,
    types: ["overpayment_pending"],
  });
}

/**
 * Collapse duplicate open overpayment cases:
 * - keep the newest pending_choice per partner
 * - drop pending rows whose Nomba transaction already has a resolved case
 */
export async function consolidateDuplicateOverpayments(): Promise<{
  dismissed: number;
  partnersAffected: number;
}> {
  let dismissed = 0;
  const partnersAffected = new Set<string>();

  const partners = await Partner.findAll();
  for (const partner of partners) {
    const pending = await OverpaymentCase.findAll({
      where: { partnerId: partner.id, status: "pending_choice" },
      order: [["createdAt", "DESC"]],
    });

    if (pending.length > 1) {
      for (const row of pending.slice(1)) {
        await dismissOverpaymentCase(row);
        dismissed += 1;
        partnersAffected.add(partner.id);
      }
    }
  }

  const stillOpen = await OverpaymentCase.findAll({
    where: { status: "pending_choice" },
    include: [{ model: Payment, as: "payment" }],
  });

  for (const row of stillOpen) {
    const payment = (row as OverpaymentCase & { payment?: Payment }).payment;
    if (!payment?.nombaTransactionId) continue;

    const resolvedForTx = await OverpaymentCase.findOne({
      where: {
        partnerId: row.partnerId,
        id: { [Op.ne]: row.id },
        status: { [Op.in]: ["credited", "refunded"] },
      },
      include: [
        {
          model: Payment,
          as: "payment",
          where: { nombaTransactionId: payment.nombaTransactionId },
          required: true,
        },
      ],
    });

    if (resolvedForTx) {
      await dismissOverpaymentCase(row);
      dismissed += 1;
      partnersAffected.add(row.partnerId);
    }
  }

  for (const partner of partners) {
    const lastResolved = await OverpaymentCase.findOne({
      where: {
        partnerId: partner.id,
        status: { [Op.in]: ["credited", "refunded"] },
        resolvedAt: { [Op.ne]: null },
      },
      order: [["resolvedAt", "DESC"]],
    });

    if (!lastResolved?.resolvedAt) continue;

    const stalePending = await OverpaymentCase.findAll({
      where: { partnerId: partner.id, status: "pending_choice" },
      include: [{ model: Payment, as: "payment" }],
    });

    for (const row of stalePending) {
      const payment = (row as OverpaymentCase & { payment?: Payment }).payment;
      const paymentAt = (payment as Payment & { createdAt?: Date })?.createdAt
        ? new Date((payment as Payment & { createdAt?: Date }).createdAt!).getTime()
        : 0;
      const resolvedAt = new Date(lastResolved.resolvedAt).getTime();

      if (paymentAt > 0 && paymentAt <= resolvedAt) {
        await dismissOverpaymentCase(row);
        dismissed += 1;
        partnersAffected.add(partner.id);
      }
    }
  }

  return { dismissed, partnersAffected: partnersAffected.size };
}
