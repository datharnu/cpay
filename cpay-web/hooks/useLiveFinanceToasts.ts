"use client";

import { formatMoney } from "@/components/shared/AppShell";
import { useToast } from "@/components/shared/Toast";
import { useDashboardSummary } from "@/hooks/useCpay";
import { useEffect, useRef } from "react";

type SeenState = {
  ready: boolean;
  paymentIds: Set<string>;
  overpaymentIds: Set<string>;
  refundPendingIds: Set<string>;
};

function classificationLabel(classification?: string | null): string {
  switch (classification) {
    case "exact":
      return "Monthly dues matched";
    case "under":
      return "Underpayment recorded";
    case "over":
      return "Overpayment detected";
    case "catch_up":
      return "Catch-up payment";
    case "unmatched":
      return "Unmatched transfer";
    default:
      return "Payment reconciled";
  }
}

export function useLiveFinanceToasts() {
  const { data: summary } = useDashboardSummary();
  const { success, info, warning } = useToast();
  const seen = useRef<SeenState>({
    ready: false,
    paymentIds: new Set(),
    overpaymentIds: new Set(),
    refundPendingIds: new Set(),
  });

  useEffect(() => {
    if (!summary) return;

    const paymentIds = new Set(summary.recentPayments.map((p) => p.id));
    const overpaymentIds = new Set(summary.recentOverpayments.map((o) => o.id));
    const refundPendingIds = new Set(summary.recentPendingRefunds.map((r) => r.id));

    if (!seen.current.ready) {
      seen.current = {
        ready: true,
        paymentIds,
        overpaymentIds,
        refundPendingIds,
      };
      return;
    }

    for (const payment of summary.recentPayments) {
      if (seen.current.paymentIds.has(payment.id)) continue;

      const payer =
        payment.partnerName ??
        payment.senderName ??
        payment.virtualAccountNumber ??
        "Unknown payer";

      success(
        `${classificationLabel(payment.classification)}: ${formatMoney(payment.amount)} from ${payer}`,
        7000
      );
    }

    for (const item of summary.recentOverpayments) {
      if (seen.current.overpaymentIds.has(item.id)) continue;

      info(
        `${item.partnerName} overpaid by ${formatMoney(item.excess)} — finance action required`,
        7000
      );
    }

    for (const item of summary.recentPendingRefunds) {
      if (seen.current.refundPendingIds.has(item.id)) continue;

      warning(
        `Refund pending Nomba settlement: ${formatMoney(item.excess)} for ${item.partnerName} → ${item.refundAccountName ?? "bank account"}. Sandbox outbound transfers are simulated.`,
        9000
      );
    }

    for (const id of seen.current.refundPendingIds) {
      if (refundPendingIds.has(id)) continue;
      success("Nomba confirmed refund settlement.", 6000);
    }

    seen.current = {
      ready: true,
      paymentIds,
      overpaymentIds,
      refundPendingIds,
    };
  }, [summary, success, info, warning]);
}

export function LiveFinanceToasts() {
  useLiveFinanceToasts();
  return null;
}
