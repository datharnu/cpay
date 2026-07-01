"use client";

import { useState } from "react";
import { formatMoney, StatusBadge } from "@/components/shared/AppShell";
import { PageSection } from "@/components/shared/ui";
import { PaymentsTable, type PaymentTableRow } from "@/components/partners/PaymentsTable";
import { useResolveOverpayment, useCheckRefundStatus } from "@/hooks/useCpay";
import { useNotificationActivity } from "@/hooks/useNotificationActivity";
import { useToast } from "@/components/shared/Toast";
import type { PartnerDetail, ResolveOverpaymentInput } from "@/types";

type MonthRow = PartnerDetail["months"][number];
type OverpaymentRow = PartnerDetail["overpayments"][number];

const MONTH_STATUS_STYLES: Record<string, { bar: string; dot: string }> = {
  paid: { bar: "bg-emerald-500", dot: "bg-emerald-500" },
  partial: { bar: "bg-amber-500", dot: "bg-amber-500" },
  missed: { bar: "bg-red-400", dot: "bg-red-500" },
  pending: { bar: "bg-white/40", dot: "bg-text-muted" },
};

function monthProgress(paid: number, expected: number) {
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((paid / expected) * 100));
}

export function MonthlyLedgerPanel({ months }: { months: MonthRow[] }) {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  const paidCount = months.filter((m) => m.status === "paid").length;
  const partialCount = months.filter((m) => m.status === "partial").length;
  const missedCount = months.filter((m) => m.status === "missed").length;

  const sorted = [...months].sort(
    (a, b) => b.year - a.year || b.month - a.month
  );

  return (
    <PageSection
      flush
      title="Monthly ledger"
      description="Commitment vs. payments per month — from their pledged start month, newest first."
    >
      {months.length === 0 ? (
        <p className="px-5 py-8 text-text-secondary">No months tracked yet.</p>
      ) : (
        <>
          <div className="grid gap-3 border-b border-white/35 p-5 sm:grid-cols-3">
            <LedgerStat label="Fully paid" value={String(paidCount)} tone="success" />
            <LedgerStat label="Partial" value={String(partialCount)} tone="warning" />
            <LedgerStat label="Missed" value={String(missedCount)} tone="danger" />
          </div>

          <div className="overflow-x-auto">
            <table className="detail-table w-full min-w-[640px]">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Expected</th>
                  <th>Paid</th>
                  <th>Progress</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((month) => {
                  const key = `${month.year}-${month.month}`;
                  const isCurrent = key === currentKey;
                  const isFuture =
                    month.year > now.getFullYear() ||
                    (month.year === now.getFullYear() && month.month > now.getMonth() + 1);
                  const isPrepaid = isFuture && month.status === "paid";
                  const pct = monthProgress(month.paid, month.expected);
                  const styles = MONTH_STATUS_STYLES[month.status] ?? MONTH_STATUS_STYLES.pending;

                  return (
                    <tr
                      key={key}
                      className={isCurrent ? "bg-primary-subtle/60" : undefined}
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                          <div>
                            <p className="font-medium text-text-primary">{month.label}</p>
                            {isCurrent ? (
                              <p className="text-xs font-medium text-primary">Current month</p>
                            ) : isPrepaid ? (
                              <p className="text-xs font-medium text-emerald-700">Pre-paid from credit</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="text-text-secondary">{formatMoney(month.expected)}</td>
                      <td className="font-semibold">{formatMoney(month.paid)}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/35">
                            <div
                              className={`h-full rounded-full transition-all ${styles.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-text-muted">{pct}%</span>
                        </div>
                      </td>
                      <td className="text-right">
                        <StatusBadge status={month.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageSection>
  );
}

function LedgerStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger";
}) {
  const tones = {
    success:
      "border-2 border-emerald-400 bg-emerald-500/12 text-emerald-900 shadow-sm ring-1 ring-emerald-400/30",
    warning:
      "border-2 border-amber-400 bg-amber-500/12 text-amber-900 shadow-sm ring-1 ring-amber-400/30",
    danger:
      "border-2 border-red-400 bg-red-500/12 text-red-900 shadow-sm ring-1 ring-red-400/30",
  };

  return (
    <div className={`rounded-xl px-4 py-3.5 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

type PaymentRow = PartnerDetail["payments"][number];

export function PaymentHistoryPanel({ payments }: { payments: PaymentRow[] }) {
  const rows: PaymentTableRow[] = payments.map((p) => ({
    id: p.id,
    amount: p.amount,
    classification: p.classification,
    senderName: p.senderName,
    nombaTransactionId: p.nombaTransactionId,
    createdAt: p.createdAt,
  }));

  return (
    <PageSection
      flush
      title="Payment history"
      description="Every transfer to this member's dedicated account — reconciled via Nomba webhooks."
    >
      <PaymentsTable payments={rows} />
    </PageSection>
  );
}

export function OverpaymentsPanel({
  overpayments,
}: {
  overpayments: OverpaymentRow[];
}) {
  if (overpayments.length === 0) return null;

  const pending = overpayments.filter((o) => o.status === "pending_choice");
  const refundPending = overpayments.filter((o) => o.status === "refund_pending");
  const settled = overpayments.filter(
    (o) => o.status === "credited" || o.status === "refunded"
  );

  return (
    <PageSection
      title="Overpayments"
      description={
        pending.length > 0
          ? `${pending.length} awaiting your decision — apply excess to next month or refund the member.`
          : "History of excess payments and how they were resolved."
      }
    >
      <div className="space-y-6">
        {pending.length > 0 && (
          <div className="space-y-4">
            {pending.length > 1 ? (
              <p className="text-sm font-medium text-primary">
                {pending.length} overpayments need action
              </p>
            ) : null}
            {pending.map((item) => (
              <OverpaymentActionBlock key={item.id} item={item} />
            ))}
          </div>
        )}

        {refundPending.length > 0 && (
          <div>
            {pending.length > 0 ? (
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Refunds in progress
              </h3>
            ) : null}
            <ul className="divide-y divide-white/35 rounded-2xl border border-amber-200/60 bg-amber-500/5 overflow-hidden">
              {refundPending.map((item) => (
                <RefundPendingRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        )}

        {settled.length > 0 && (
          <div>
            {(pending.length > 0 || refundPending.length > 0) && (
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Resolved
              </h3>
            )}
            <ul className="divide-y divide-white/30 rounded-2xl border border-white/40 overflow-hidden">
              {settled.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-text-primary">
                      {formatMoney(item.excess)} excess
                    </p>
                    {item.merchantTxRef ? (
                      <p className="font-mono text-xs text-text-muted">{item.merchantTxRef}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </PageSection>
  );
}

function OverpaymentActionBlock({ item }: { item: OverpaymentRow }) {
  const resolve = useResolveOverpayment();
  const { success, warning } = useToast();
  const { markRead } = useNotificationActivity();
  const [mode, setMode] = useState<"pick" | "refund">("pick");
  const [bankCode, setBankCode] = useState("999992");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  async function handleCredit() {
    const result = await resolve.mutateAsync({
      id: item.id,
      input: { choice: "credit_next_month" },
    });
    success(result.message ?? "Credited to next month.");
    markRead(`overpay-${item.id}`);
  }

  async function handleRefund(e: React.FormEvent) {
    e.preventDefault();
    const input: ResolveOverpaymentInput = {
      choice: "refund",
      bankCode,
      accountNumber,
      accountName,
    };
    const result = await resolve.mutateAsync({ id: item.id, input });
    warning(
      result.message ??
        `Refund initiated — ${formatMoney(item.excess)} pending Nomba settlement.`,
      9000
    );
    markRead(`overpay-${item.id}`);
    setMode("pick");
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary-subtle/30 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Action required
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-text-primary">
            {formatMoney(item.excess)}
            <span className="ml-2 text-sm font-normal text-text-secondary">excess</span>
          </p>
        </div>
        <StatusBadge status="pending_choice" />
      </div>

      {mode === "pick" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleCredit}
            disabled={resolve.isPending}
            className="group rounded-xl border border-white/50 bg-white/30 p-4 text-left transition hover:border-emerald-300/80 hover:bg-emerald-500/8 disabled:opacity-60"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </span>
            <p className="mt-3 font-semibold text-text-primary">Apply to upcoming months</p>
            <p className="mt-1 text-sm text-text-secondary">
              Uses the full payment for future months (e.g. ₦100 → 2 months at ₦50 each).
            </p>
            <span className="mt-3 inline-flex text-sm font-medium text-emerald-700 group-hover:underline">
              {resolve.isPending ? "Applying…" : "Apply credit →"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("refund")}
            disabled={resolve.isPending}
            className="group rounded-xl border border-white/50 bg-white/30 p-4 text-left transition hover:border-primary/40 hover:bg-primary-muted/40 disabled:opacity-60"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.375M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </span>
            <p className="mt-3 font-semibold text-text-primary">Refund to bank</p>
            <p className="mt-1 text-sm text-text-secondary">
              Send the excess back via Nomba Transfers (sandbox test bank 999992).
            </p>
            <span className="mt-3 inline-flex text-sm font-medium text-primary group-hover:underline">
              Enter bank details →
            </span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleRefund} className="space-y-3 rounded-xl border border-white/45 bg-white/25 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">Refund bank details</p>
            <button
              type="button"
              onClick={() => setMode("pick")}
              className="text-xs font-medium text-text-muted hover:text-text-primary"
            >
              ← Back to options
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className="input-field"
              placeholder="Bank code (999992)"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              required
            />
            <input
              className="input-field"
              placeholder="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
            <input
              className="input-field"
              placeholder="Account name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={resolve.isPending} className="btn-primary">
            {resolve.isPending
              ? "Initiating…"
              : `Initiate refund ${formatMoney(item.excess)}`}
          </button>
        </form>
      )}
    </div>
  );
}

function RefundPendingRow({
  item,
}: {
  item: OverpaymentRow;
}) {
  const checkRefund = useCheckRefundStatus();
  const { success, info } = useToast();
  const { markRead } = useNotificationActivity();

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-text-primary">{formatMoney(item.excess)}</p>
          <StatusBadge status="refund_pending" />
        </div>
        <p className="mt-0.5 text-sm text-text-secondary">
          To {item.refundAccountName ?? "bank account"} · {item.refundAccountNumber ?? "—"}
        </p>
        {item.merchantTxRef ? (
          <p className="mt-0.5 font-mono text-xs text-text-muted">{item.merchantTxRef}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={async () => {
          const result = await checkRefund.mutateAsync(item.id);
          const text = result.message ?? "Status checked.";
          if (
            text.toLowerCase().includes("settled") ||
            text.toLowerCase().includes("refunded")
          ) {
            success(text);
            markRead(`refund-${item.id}`);
            markRead(`refund-settled-${item.id}`);
          } else {
            info(text);
          }
        }}
        disabled={checkRefund.isPending}
        className="btn-secondary shrink-0 text-xs sm:text-sm"
      >
        {checkRefund.isPending ? "Checking…" : "Check settlement"}
      </button>
    </li>
  );
}
