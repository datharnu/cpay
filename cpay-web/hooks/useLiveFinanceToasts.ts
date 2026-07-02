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

function isCpayOutboundPaymentNoise(payment: {
  classification?: string | null;
  senderName?: string | null;
  partnerName?: string | null;
  nombaTransactionId?: string | null;
}): boolean {
  if (payment.classification !== "unmatched") return false;
  const blob = [
    payment.senderName,
    payment.partnerName,
    payment.nombaTransactionId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    blob.includes("cpay overpay") ||
    blob.includes("cpay overpayment") ||
    blob.includes("cpay_overpay_")
  );
}

export function useLiveFinanceToasts() {
  const { data: summary } = useDashboardSummary();
  const { success, info } = useToast();
  const { push } = useNotificationActivity();
  const seen = useRef<SeenState>({
    ready: false,
    paymentIds: new Set(),
    overpaymentIds: new Set(),
  });

  useEffect(() => {
    if (!summary) return;

    const paymentIds = new Set(summary.recentPayments.map((p) => p.id));
    const overpaymentIds = new Set(summary.recentOverpayments.map((o) => o.id));

    if (!seen.current.ready) {
      seen.current = {
        ready: true,
        paymentIds,
        overpaymentIds,
      };
      return;
    }

    for (const payment of summary.recentPayments) {
      if (seen.current.paymentIds.has(payment.id)) continue;
      if (isCpayOutboundPaymentNoise(payment)) continue;

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

    seen.current = {
      ready: true,
      paymentIds,
      overpaymentIds,
    };
  }, [summary, success, info, push]);
}

export function LiveFinanceToasts() {
  useLiveFinanceToasts();
  return null;
}
