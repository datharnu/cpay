"use client";

import { formatMoney } from "@/components/shared/AppShell";
import { useToast } from "@/components/shared/Toast";
import { useDashboardSummary } from "@/hooks/useCpay";
import { useNotificationActivity } from "@/hooks/useNotificationActivity";
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
  const { push } = useNotificationActivity();
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

      const message = `${classificationLabel(payment.classification)}: ${formatMoney(payment.amount)} from ${payer}`;

      success(message, 7000);
      push({
        id: `payment-${payment.id}`,
        title: classificationLabel(payment.classification),
        message,
        tone: "success",
        partnerId: payment.partnerId ?? undefined,
        partnerName: payment.partnerName ?? undefined,
        href: payment.partnerId ? `/partners/${payment.partnerId}` : undefined,
      });
    }

    for (const item of summary.recentOverpayments) {
      if (seen.current.overpaymentIds.has(item.id)) continue;

      const message = `${item.partnerName} overpaid by ${formatMoney(item.excess)} — finance action required`;

      info(message, 7000);
      push({
        id: `overpay-${item.id}`,
        title: "Overpayment — action needed",
        message,
        tone: "info",
        partnerId: item.partnerId,
        partnerName: item.partnerName,
        href: `/partners/${item.partnerId}`,
      });
    }

    for (const item of summary.recentPendingRefunds) {
      if (seen.current.refundPendingIds.has(item.id)) continue;

      const message = `Refund pending Nomba settlement: ${formatMoney(item.excess)} for ${item.partnerName} → ${item.refundAccountName ?? "bank account"}. Sandbox outbound transfers are simulated.`;

      warning(message, 9000);
      push({
        id: `refund-${item.id}`,
        title: "Refund pending settlement",
        message,
        tone: "warning",
        partnerId: item.partnerId,
        partnerName: item.partnerName,
        href: `/partners/${item.partnerId}`,
      });
    }

    for (const id of seen.current.refundPendingIds) {
      if (refundPendingIds.has(id)) continue;

      const message = "Nomba confirmed refund settlement.";
      success(message, 6000);
      push({
        id: `refund-settled-${id}`,
        title: "Refund settled",
        message,
        tone: "success",
      });
    }

    seen.current = {
      ready: true,
      paymentIds,
      overpaymentIds,
      refundPendingIds,
    };
  }, [summary, success, info, warning, push]);
}

export function LiveFinanceToasts() {
  useLiveFinanceToasts();
  return null;
}
