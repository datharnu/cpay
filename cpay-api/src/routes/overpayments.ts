import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  OverpaymentCase,
  Partner,
  PartnerNotification,
  Payment,
} from "../models";
import { markPartnerNotificationsRead } from "../services/notifications";
import { formatNaira, koboToNaira, applyOverpaymentToFutureMonths } from "../services/ledger";
import {
  getTransferStatus,
  lookupBankAccount,
  sendBankTransfer,
} from "../services/nombaClient";
import {
  trySettleOverpaymentRefund,
  settleAllPendingRefunds,
} from "../services/refundSettlement";

export const overpaymentsRouter = Router();

function mapOverpaymentCase(c: OverpaymentCase) {
  const partner = (c as OverpaymentCase & { partner?: Partner }).partner;
  const payment = (c as OverpaymentCase & { payment?: Payment }).payment;
  return {
    id: c.id,
    partnerId: c.partnerId,
    partnerName: partner?.fullName ?? "Unknown",
    paymentId: c.paymentId,
    paymentAmount: payment ? koboToNaira(payment.amountKobo) : 0,
    excess: koboToNaira(c.excessKobo),
    status: c.status,
    choice: c.choice,
    merchantTxRef: c.merchantTxRef,
    refundAccountName: c.refundAccountName,
    refundAccountNumber: c.refundAccountNumber,
    createdAt: (c as OverpaymentCase & { createdAt?: Date }).createdAt ?? null,
  };
}

overpaymentsRouter.get("/", async (_req, res) => {
  await settleAllPendingRefunds();

  const cases = await OverpaymentCase.findAll({
    where: { status: "pending_choice" },
    include: [
      { model: Partner, as: "partner" },
      { model: Payment, as: "payment" },
    ],
    order: [["createdAt", "DESC"]],
  });

  res.json({ data: cases.map(mapOverpaymentCase) });
});

overpaymentsRouter.get("/pending-refunds", async (_req, res) => {
  await settleAllPendingRefunds();

  const cases = await OverpaymentCase.findAll({
    where: { status: "refund_pending" },
    include: [
      { model: Partner, as: "partner" },
      { model: Payment, as: "payment" },
    ],
    order: [["createdAt", "DESC"]],
  });

  res.json({ data: cases.map(mapOverpaymentCase) });
});

const resolveSchema = z.discriminatedUnion("choice", [
  z.object({ choice: z.literal("credit_next_month") }),
  z.object({
    choice: z.literal("refund"),
    bankCode: z.string().min(3),
    accountNumber: z.string().min(10),
    accountName: z.string().min(2),
  }),
]);

overpaymentsRouter.post("/:id/resolve", async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const overpayment = await OverpaymentCase.findByPk(req.params.id, {
    include: [
      { model: Partner, as: "partner" },
      { model: Payment, as: "payment" },
    ],
  });

  if (!overpayment) {
    res.status(404).json({ message: "Overpayment case not found" });
    return;
  }

  if (overpayment.status !== "pending_choice") {
    res.status(400).json({ message: "This overpayment was already resolved" });
    return;
  }

  const partner = (overpayment as OverpaymentCase & { partner?: Partner }).partner;
  if (!partner) {
    res.status(404).json({ message: "Partner not found" });
    return;
  }

  const { choice } = parsed.data;

  if (choice === "credit_next_month") {
    const payment = (overpayment as OverpaymentCase & { payment?: Payment }).payment;
    if (!payment) {
      res.status(404).json({ message: "Linked payment not found" });
      return;
    }

    const creditResult = await applyOverpaymentToFutureMonths(partner.id, payment.id);
    await partner.reload();

    overpayment.status = "credited";
    overpayment.choice = "credit_next_month";
    overpayment.resolvedAt = new Date();
    await overpayment.save();

    await markPartnerNotificationsRead(partner.id, {
      paymentId: overpayment.paymentId,
      types: ["overpayment_pending"],
    });

    const prepaidText =
      creditResult.prepaidLabels.length > 0
        ? creditResult.prepaidLabels.join(", ")
        : "upcoming months";

    await PartnerNotification.create({
      partnerId: partner.id,
      paymentId: overpayment.paymentId,
      type: "overpayment_resolved",
      title: "Overpayment applied to upcoming months",
      message: `${formatNaira(payment.amountKobo)} applied to ${prepaidText} for ${partner.fullName}.`,
    });

    res.json({
      data: {
        id: overpayment.id,
        status: overpayment.status,
        choice: overpayment.choice,
        creditBalance: koboToNaira(partner.creditBalanceKobo ?? 0),
        prepaidMonths: creditResult.prepaidLabels,
        message:
          creditResult.prepaidLabels.length > 0
            ? `${formatNaira(payment.amountKobo)} applied — ${prepaidText} now show as paid in the ledger.`
            : `${formatNaira(payment.amountKobo)} credited toward upcoming months.`,
      },
    });
    return;
  }

  const { bankCode, accountNumber, accountName } = parsed.data;
  const merchantTxRef = `cpay_overpay_${uuidv4().replace(/-/g, "").slice(0, 16)}`;

  try {
    const verified = await lookupBankAccount(bankCode, accountNumber);
    const resolvedName = verified.accountName || accountName;

    const transfer = await sendBankTransfer({
      amountKobo: overpayment.excessKobo,
      bankCode,
      accountNumber: verified.accountNumber || accountNumber,
      accountName: resolvedName,
      merchantTxRef,
      narration: `CPay overpayment refund — ${partner.fullName}`,
    });

    overpayment.status = "refund_pending";
    overpayment.choice = "refund";
    overpayment.merchantTxRef = merchantTxRef;
    overpayment.refundBankCode = bankCode;
    overpayment.refundAccountNumber = accountNumber;
    overpayment.refundAccountName = resolvedName;
    await overpayment.save();

    await PartnerNotification.create({
      partnerId: partner.id,
      paymentId: overpayment.paymentId,
      type: "overpayment_pending",
      title: "Refund initiated — pending settlement",
      message: `${formatNaira(overpayment.excessKobo)} sent to ${resolvedName} (${verified.accountNumber || accountNumber}) via Nomba Transfers API. CPay will mark settled when Nomba confirms.`,
    });

    let statusDetail: Record<string, unknown> | null = null;
    try {
      const status = await getTransferStatus(merchantTxRef);
      statusDetail = (status.data ?? null) as Record<string, unknown> | null;
    } catch {
      statusDetail = null;
    }

    const settled = await trySettleOverpaymentRefund(overpayment);

    if (settled.status === "refunded") {
      await markPartnerNotificationsRead(partner.id, {
        paymentId: overpayment.paymentId,
        types: ["overpayment_pending"],
      });
    }

    res.json({
      data: {
        id: settled.id,
        status: settled.status,
        choice: settled.choice,
        amount: koboToNaira(settled.excessKobo),
        merchantTxRef,
        transfer: transfer.data,
        statusDetail,
        message:
          settled.status === "refunded"
            ? `${formatNaira(settled.excessKobo)} refund confirmed settled by Nomba.`
            : `Refund initiated — pending Nomba settlement to ${resolvedName} (${verified.accountNumber || accountNumber}).`,
      },
    });
  } catch (err) {
    res.status(502).json({
      message: err instanceof Error ? err.message : "Refund transfer failed",
    });
  }
});

overpaymentsRouter.post("/:id/check-refund", async (req, res) => {
  const overpayment = await OverpaymentCase.findByPk(req.params.id);
  if (!overpayment) {
    res.status(404).json({ message: "Overpayment case not found" });
    return;
  }

  if (overpayment.status !== "refund_pending") {
    res.status(400).json({
      message: "Only refund_pending cases can be checked for settlement",
    });
    return;
  }

  const before = overpayment.status;
  const settled = await trySettleOverpaymentRefund(overpayment);

  let statusDetail: Record<string, unknown> | null = null;
  if (settled.merchantTxRef) {
    try {
      const status = await getTransferStatus(settled.merchantTxRef);
      statusDetail = (status.data ?? null) as Record<string, unknown> | null;
    } catch {
      statusDetail = null;
    }
  }

  res.json({
    data: {
      id: settled.id,
      status: settled.status,
      merchantTxRef: settled.merchantTxRef,
      statusDetail,
      settled: before === "refund_pending" && settled.status === "refunded",
      message:
        settled.status === "refunded"
          ? "Nomba confirmed settlement — refund complete."
          : "Refund still pending — Nomba has not confirmed settlement yet.",
    },
  });
});
