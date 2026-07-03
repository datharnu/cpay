import { Router } from "express";
import { OverpaymentCase, Partner, PartnerMonth, Payment } from "../models";
import { koboToNaira } from "../services/ledger";
import { fetchSubAccountBalance } from "../services/nombaClient";
import { settleAllPendingRefunds } from "../services/refundSettlement";
import { consolidateDuplicateOverpayments } from "../services/overpaymentConsolidation";

export const dashboardRouter = Router();

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-NG", {
    month: "short",
    year: "2-digit",
  });
}

function isAfterCurrentMonth(year: number, month: number, now = new Date()) {
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  return year > cy || (year === cy && month > cm);
}

/** Ledger-based chart: paidKobo per month, extends into future when overpayment credit pre-pays months. */
function buildMonthlyCollections(partnerMonths: PartnerMonth[], lookbackMonths: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const start = new Date(currentYear, currentMonth - 1 - (lookbackMonths - 1), 1);
  let end = new Date(currentYear, currentMonth - 1, 1);

  for (const m of partnerMonths) {
    const d = new Date(m.year, m.month - 1, 1);
    if (d > end && m.paidKobo > 0) end = d;
  }

  const buckets: Array<{ year: number; month: number; label: string }> = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    buckets.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      label: monthLabel(cursor.getFullYear(), cursor.getMonth() + 1),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets.map((bucket) => {
    const rows = partnerMonths.filter(
      (m) => m.year === bucket.year && m.month === bucket.month
    );
    const expectedKobo = rows.reduce((sum, m) => sum + m.expectedKobo, 0);
    const collectedKobo = rows.reduce((sum, m) => sum + m.paidKobo, 0);
    const future = isAfterCurrentMonth(bucket.year, bucket.month, now);
    const prepaid = future && collectedKobo > 0;

    return {
      year: bucket.year,
      month: bucket.month,
      label: bucket.label,
      expected: koboToNaira(expectedKobo),
      collected: koboToNaira(collectedKobo),
      isFuture: future,
      prepaid,
    };
  });
}

dashboardRouter.get("/summary", async (_req, res, next) => {
  try {
    try {
      await settleAllPendingRefunds();
    } catch (err) {
      console.error("[dashboard] refund settlement poll failed:", err);
    }

    try {
      await consolidateDuplicateOverpayments();
    } catch (err) {
      console.error("[dashboard] overpayment consolidation failed:", err);
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

    const monthlyCollections6 = buildMonthlyCollections(partnerMonths, 6);
    const monthlyCollections12 = buildMonthlyCollections(partnerMonths, 12);

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

    let nombaWalletBalance: number | null = null;
    let nombaWalletCurrency: string | null = null;
    let nombaWalletError: string | null = null;
    try {
      const wallet = await fetchSubAccountBalance();
      nombaWalletBalance = wallet.amountNaira;
      nombaWalletCurrency = wallet.currency;
    } catch (err) {
      nombaWalletError =
        err instanceof Error ? err.message : "Could not load Nomba balance";
      console.error("[dashboard] Nomba wallet balance failed:", err);
    }

    res.json({
      data: {
        totalPartners: partners.length,
        activePartners: partners.filter((p) => p.status === "active").length,
        totalPayments: payments.length,
        totalCollected: koboToNaira(totalCollectedKobo),
        nombaWalletBalance,
        nombaWalletCurrency,
        nombaWalletError,
        collectedThisMonth: koboToNaira(collectedThisMonthKobo),
        expectedThisMonth: koboToNaira(expectedThisMonthKobo),
        collectionRate,
        membersPaidThisMonth,
        membersTrackedThisMonth,
        monthlyCollections: monthlyCollections6,
        monthlyCollections6,
        monthlyCollections12,
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
