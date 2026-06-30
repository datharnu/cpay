import { Router } from "express";
import { OverpaymentCase, Partner, PartnerMonth, Payment } from "../models";
import { koboToNaira } from "../services/ledger";
import { settleAllPendingRefunds } from "../services/refundSettlement";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", async (_req, res) => {
  await settleAllPendingRefunds();

  const partners = await Partner.findAll();
  const payments = await Payment.findAll();
  const unmatched = payments.filter((p) => p.classification === "unmatched");
  const pendingOverpaymentCount = await OverpaymentCase.count({
    where: { status: "pending_choice" },
  });
  const pendingRefundCount = await OverpaymentCase.count({
    where: { status: "refund_pending" },
  });
  const pendingOverpayments = await OverpaymentCase.findAll({
    where: { status: "pending_choice" },
    include: [{ model: Partner, as: "partner" }],
    order: [["createdAt", "DESC"]],
    limit: 10,
  });
  const pendingRefunds = await OverpaymentCase.findAll({
    where: { status: "refund_pending" },
    include: [{ model: Partner, as: "partner" }],
    order: [["createdAt", "DESC"]],
    limit: 10,
  });
  const recentPayments = await Payment.findAll({
    order: [["createdAt", "DESC"]],
    limit: 15,
    include: [{ model: Partner }],
  });

  let totalArrearsKobo = 0;
  for (const p of partners) {
    const months = await PartnerMonth.findAll({ where: { partnerId: p.id } });
    for (const m of months) {
      if (m.status === "missed" || m.status === "partial") {
        totalArrearsKobo += Math.max(0, m.expectedKobo - m.paidKobo);
      }
    }
  }

  res.json({
    data: {
      totalPartners: partners.length,
      activePartners: partners.filter((p) => p.status === "active").length,
      totalPayments: payments.length,
      unmatchedPayments: unmatched.length,
      totalArrears: koboToNaira(totalArrearsKobo),
      pendingOverpayments: pendingOverpaymentCount,
      pendingRefunds: pendingRefundCount,
      recentOverpayments: pendingOverpayments.map((c) => {
        const partner = (c as OverpaymentCase & { partner?: Partner }).partner;
        return {
          id: c.id,
          partnerId: c.partnerId,
          partnerName: partner?.fullName ?? "Unknown",
          excess: koboToNaira(c.excessKobo),
          status: c.status,
          createdAt: (c as OverpaymentCase & { createdAt?: Date }).createdAt ?? null,
        };
      }),
      recentPendingRefunds: pendingRefunds.map((c) => {
        const partner = (c as OverpaymentCase & { partner?: Partner }).partner;
        return {
          id: c.id,
          partnerId: c.partnerId,
          partnerName: partner?.fullName ?? "Unknown",
          excess: koboToNaira(c.excessKobo),
          merchantTxRef: c.merchantTxRef,
          refundAccountName: c.refundAccountName,
          refundAccountNumber: c.refundAccountNumber,
          createdAt: (c as OverpaymentCase & { createdAt?: Date }).createdAt ?? null,
        };
      }),
      recentUnmatched: unmatched.slice(-5).reverse().map((p) => ({
        id: p.id,
        amount: koboToNaira(p.amountKobo),
        virtualAccountNumber: p.virtualAccountNumber,
        createdAt: (p as Payment & { createdAt?: Date }).createdAt ?? null,
      })),
      recentPayments: recentPayments.map((p) => {
        const partner = (p as Payment & { Partner?: Partner }).Partner;
        return {
          id: p.id,
          partnerId: p.partnerId,
          partnerName: partner?.fullName ?? null,
          amount: koboToNaira(p.amountKobo),
          classification: p.classification,
          virtualAccountNumber: p.virtualAccountNumber,
          senderName: p.senderName,
          createdAt: (p as Payment & { createdAt?: Date }).createdAt ?? null,
        };
      }),
    },
  });
});

dashboardRouter.get("/unmatched", async (_req, res) => {
  const rows = await Payment.findAll({
    where: { classification: "unmatched" },
    order: [["createdAt", "DESC"]],
  });

  res.json({
    data: rows.map((p) => ({
      id: p.id,
      amount: koboToNaira(p.amountKobo),
      virtualAccountNumber: p.virtualAccountNumber,
      senderName: p.senderName,
      createdAt: (p as Payment & { createdAt?: Date }).createdAt ?? null,
    })),
  });
});
