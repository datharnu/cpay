import { Router } from "express";
import { OverpaymentCase, Partner, PartnerMonth, Payment } from "../models";
import { koboToNaira } from "../services/ledger";
import { settleAllPendingRefunds } from "../services/refundSettlement";

export const dashboardRouter = Router();

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-NG", {
    month: "short",
    year: "2-digit",
  });
}

function lastCalendarMonths(count: number) {
  const now = new Date();
  const buckets: Array<{ year: number; month: number; label: string }> = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: monthLabel(d.getFullYear(), d.getMonth() + 1),
    });
  }
  return buckets;
}

function paymentInMonth(
  payment: Payment & { createdAt?: Date },
  year: number,
  month: number
) {
  const created = (payment as Payment & { createdAt?: Date }).createdAt;
  if (!created) return false;
  const d = new Date(created);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

dashboardRouter.get("/summary", async (_req, res, next) => {
  try {
    try {
      await settleAllPendingRefunds();
    } catch (err) {
      console.error("[dashboard] refund settlement poll failed:", err);
    }

    const partners = await Partner.findAll();
    const payments = await Payment.findAll();
    const partnerMonths = await PartnerMonth.findAll();
    const unmatched = payments.filter((p) => p.classification === "unmatched");

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let totalArrearsKobo = 0;
    let expectedThisMonthKobo = 0;
    let collectedThisMonthKobo = 0;
    let membersPaidThisMonth = 0;
    let membersTrackedThisMonth = 0;

    for (const m of partnerMonths) {
      if (m.status === "missed" || m.status === "partial") {
        totalArrearsKobo += Math.max(0, m.expectedKobo - m.paidKobo);
      }
      if (m.year === currentYear && m.month === currentMonth) {
        membersTrackedThisMonth += 1;
        expectedThisMonthKobo += m.expectedKobo;
        collectedThisMonthKobo += m.paidKobo;
        if (m.status === "paid") membersPaidThisMonth += 1;
      }
    }

    const totalCollectedKobo = payments
      .filter((p) => p.classification !== "unmatched")
      .reduce((sum, p) => sum + p.amountKobo, 0);

    const collectionRate =
      expectedThisMonthKobo > 0
        ? Math.min(100, Math.round((collectedThisMonthKobo / expectedThisMonthKobo) * 100))
        : 0;

    const chartMonths = lastCalendarMonths(6).map((bucket) => {
      const expectedKobo = partnerMonths
        .filter((m) => m.year === bucket.year && m.month === bucket.month)
        .reduce((sum, m) => sum + m.expectedKobo, 0);

      const collectedKobo = payments
        .filter(
          (p) =>
            p.classification !== "unmatched" &&
            paymentInMonth(p as Payment & { createdAt?: Date }, bucket.year, bucket.month)
        )
        .reduce((sum, p) => sum + p.amountKobo, 0);

      return {
        year: bucket.year,
        month: bucket.month,
        label: bucket.label,
        expected: koboToNaira(expectedKobo),
        collected: koboToNaira(collectedKobo),
      };
    });

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

    res.json({
      data: {
        totalPartners: partners.length,
        activePartners: partners.filter((p) => p.status === "active").length,
        totalPayments: payments.length,
        totalCollected: koboToNaira(totalCollectedKobo),
        collectedThisMonth: koboToNaira(collectedThisMonthKobo),
        expectedThisMonth: koboToNaira(expectedThisMonthKobo),
        collectionRate,
        membersPaidThisMonth,
        membersTrackedThisMonth,
        monthlyCollections: chartMonths,
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
            nombaTransactionId: p.nombaTransactionId,
            createdAt: (p as Payment & { createdAt?: Date }).createdAt ?? null,
          };
        }),
      },
    });
  } catch (err) {
    next(err);
  }
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
