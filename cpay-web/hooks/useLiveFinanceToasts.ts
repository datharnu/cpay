"use client";

import { formatMoney } from "@/components/shared/AppShell";
import { useToast } from "@/components/shared/Toast";
import { useDashboardSummary } from "@/hooks/useCpay";
import { useNotificationActivity } from "@/hooks/useNotificationActivity";
import { useEffect, useRef } from "react";

const SEEN_STORAGE_KEY = "cpay-live-finance-toast-seen";
const BASELINE_GRACE_MS = 20_000;
const MAX_PERSISTED_IDS = 200;

type SeenState = {
  ready: boolean;
  paymentIds: Set<string>;
  nombaTxIds: Set<string>;
  overpaymentIds: Set<string>;
};

type PersistedSeen = {
  paymentIds: string[];
  nombaTxIds: string[];
  overpaymentIds: string[];
};

function loadPersistedSeen(): Pick<SeenState, "paymentIds" | "nombaTxIds" | "overpaymentIds"> {
  if (typeof window === "undefined") {
    return {
      paymentIds: new Set(),
      nombaTxIds: new Set(),
      overpaymentIds: new Set(),
    };
  }

  try {
    const raw = window.sessionStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) {
      return {
        paymentIds: new Set(),
        nombaTxIds: new Set(),
        overpaymentIds: new Set(),
      };
    }

    const parsed = JSON.parse(raw) as PersistedSeen;
    return {
      paymentIds: new Set(parsed.paymentIds ?? []),
      nombaTxIds: new Set(parsed.nombaTxIds ?? []),
      overpaymentIds: new Set(parsed.overpaymentIds ?? []),
    };
  } catch {
    return {
      paymentIds: new Set(),
      nombaTxIds: new Set(),
      overpaymentIds: new Set(),
    };
  }
}

function persistSeen(state: SeenState) {
  if (typeof window === "undefined") return;

  const payload: PersistedSeen = {
    paymentIds: [...state.paymentIds].slice(-MAX_PERSISTED_IDS),
    nombaTxIds: [...state.nombaTxIds].slice(-MAX_PERSISTED_IDS),
    overpaymentIds: [...state.overpaymentIds].slice(-MAX_PERSISTED_IDS),
  };

  try {
    window.sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

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

function isHistoricalItem(createdAt: string | null | undefined, baselineMs: number): boolean {
  if (!createdAt) return false;
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return false;
  return createdMs < baselineMs - BASELINE_GRACE_MS;
}

function rememberPayment(seen: SeenState, payment: {
  id: string;
  nombaTransactionId?: string | null;
}) {
  seen.paymentIds.add(payment.id);
  if (payment.nombaTransactionId) {
    seen.nombaTxIds.add(payment.nombaTransactionId);
  }
}

function hasSeenPayment(
  seen: SeenState,
  payment: { id: string; nombaTransactionId?: string | null }
): boolean {
  if (seen.paymentIds.has(payment.id)) return true;
  if (payment.nombaTransactionId && seen.nombaTxIds.has(payment.nombaTransactionId)) {
    return true;
  }
  return false;
}

export function useLiveFinanceToasts() {
  const { data: summary, isFetched } = useDashboardSummary();
  const { success, info } = useToast();
  const { push } = useNotificationActivity();
  const persisted = useRef(loadPersistedSeen());
  const baselineMs = useRef<number | null>(null);
  const seen = useRef<SeenState>({
    ready: false,
    paymentIds: new Set(persisted.current.paymentIds),
    nombaTxIds: new Set(persisted.current.nombaTxIds),
    overpaymentIds: new Set(persisted.current.overpaymentIds),
  });
  const successRef = useRef(success);
  const infoRef = useRef(info);
  const pushRef = useRef(push);

  successRef.current = success;
  infoRef.current = info;
  pushRef.current = push;

  useEffect(() => {
    if (!summary || !isFetched) return;

    const paymentIds = new Set(seen.current.paymentIds);
    const nombaTxIds = new Set(seen.current.nombaTxIds);
    const overpaymentIds = new Set(seen.current.overpaymentIds);

    for (const payment of summary.recentPayments) {
      paymentIds.add(payment.id);
      if (payment.nombaTransactionId) {
        nombaTxIds.add(payment.nombaTransactionId);
      }
    }
    for (const item of summary.recentOverpayments) {
      overpaymentIds.add(item.id);
    }

    if (!seen.current.ready) {
      baselineMs.current = Date.now();
      seen.current = {
        ready: true,
        paymentIds,
        nombaTxIds,
        overpaymentIds,
      };
      persistSeen(seen.current);
      return;
    }

    const baseline = baselineMs.current ?? Date.now();

    for (const payment of summary.recentPayments) {
      if (hasSeenPayment(seen.current, payment)) continue;
      if (isCpayOutboundPaymentNoise(payment)) continue;
      if (isHistoricalItem(payment.createdAt, baseline)) {
        paymentIds.add(payment.id);
        if (payment.nombaTransactionId) nombaTxIds.add(payment.nombaTransactionId);
        continue;
      }

      const payer =
        payment.partnerName ??
        payment.senderName ??
        payment.virtualAccountNumber ??
        "Unknown payer";

      const message = `${classificationLabel(payment.classification)}: ${formatMoney(payment.amount)} from ${payer}`;

      successRef.current(message, 7000);
      pushRef.current({
        id: `payment-${payment.id}`,
        title: classificationLabel(payment.classification),
        message,
        tone: "success",
        partnerId: payment.partnerId ?? undefined,
        partnerName: payment.partnerName ?? undefined,
        href: payment.partnerId ? `/partners/${payment.partnerId}` : undefined,
      });
      rememberPayment(seen.current, payment);
      paymentIds.add(payment.id);
      if (payment.nombaTransactionId) nombaTxIds.add(payment.nombaTransactionId);
    }

    for (const item of summary.recentOverpayments) {
      if (seen.current.overpaymentIds.has(item.id)) continue;
      if (isHistoricalItem(item.createdAt, baseline)) {
        overpaymentIds.add(item.id);
        continue;
      }

      const message = `${item.partnerName} overpaid by ${formatMoney(item.excess)} — finance action required`;

      infoRef.current(message, 7000);
      pushRef.current({
        id: `overpay-${item.id}`,
        title: "Overpayment — action needed",
        message,
        tone: "info",
        partnerId: item.partnerId,
        partnerName: item.partnerName,
        href: `/partners/${item.partnerId}`,
      });
      overpaymentIds.add(item.id);
    }

    seen.current = {
      ready: true,
      paymentIds,
      nombaTxIds,
      overpaymentIds,
    };
    persistSeen(seen.current);
  }, [summary, isFetched]);
}

export function LiveFinanceToasts() {
  useLiveFinanceToasts();
  return null;
}
