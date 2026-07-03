"use client";

import { use, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AppShell, formatMoney, StatusBadge } from "@/components/shared/AppShell";
import {
  MonthlyLedgerPanel,
  OverpaymentsPanel,
  PaymentHistoryPanel,
} from "@/components/partners/PartnerDetailPanels";
import { useToast } from "@/components/shared/Toast";
import { useDeactivatePartner, usePartner } from "@/hooks/useCpay";

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: partner, isLoading } = usePartner(id);
  const deactivate = useDeactivatePartner();
  const { success, error: toastError } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!confirmOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deactivate.isPending) {
        setConfirmOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmOpen, deactivate.isPending]);

  if (isLoading) {
    return (
      <AppShell title="Partner details">
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-surface-muted" />
        </div>
      </AppShell>
    );
  }

  if (!partner) {
    return (
      <AppShell title="Partner details">
        <div className="rounded-xl border border-red-200 bg-danger-bg p-6 text-red-800">
          Partner not found.
        </div>
      </AppShell>
    );
  }

  const partnerStatus = partner.status ?? "active";
  const isInactive = partnerStatus === "inactive";
  const hasOverpayments = partner.overpayments.length > 0;
  const hasPendingRefunds = partner.overpayments.some(
    (item) => item.status === "refund_pending"
  );

  async function handleDeactivate() {
    try {
      const result = await deactivate.mutateAsync(id);
      success(result.message ?? "Partner deactivated.");
      setConfirmOpen(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err instanceof Error ? err.message : "Could not deactivate partner.");
      toastError(message, 9000);
    }
  }

  const modal =
    confirmOpen && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 sm:p-6">
            <button
              type="button"
              aria-label="Close dialog"
              className="modal-backdrop-enter absolute inset-0 bg-[#1a1825]/40 backdrop-blur-md"
              onClick={() => {
                if (!deactivate.isPending) setConfirmOpen(false);
              }}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="deactivate-title"
              aria-describedby="deactivate-description"
              className="modal-enter relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/80 bg-[rgba(255,255,255,0.92)] shadow-[0_28px_80px_rgba(40,30,80,0.32)] backdrop-blur-2xl"
            >
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-red-500/10 to-transparent" />

              <div className="relative px-6 pb-6 pt-7">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/12 text-red-700 ring-1 ring-red-500/15">
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                    />
                  </svg>
                </div>

                <div className="mt-5 text-center">
                  <h2
                    id="deactivate-title"
                    className="text-xl font-semibold tracking-tight text-text-primary"
                  >
                    End partnership?
                  </h2>
                  <p
                    id="deactivate-description"
                    className="mt-2 text-sm leading-relaxed text-text-secondary"
                  >
                    This will expire{" "}
                    <span className="font-semibold text-text-primary">
                      {partner.fullName}
                    </span>
                    &apos;s Nomba virtual account and mark them inactive. New
                    transfers will no longer land on this account.
                  </p>
                </div>

                <div className="mt-5 rounded-2xl border border-white/70 bg-white/55 px-4 py-3.5 text-left shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Dedicated account
                  </p>
                  <p className="mt-1.5 font-mono text-lg font-semibold tracking-tight text-text-primary">
                    {partner.virtualAccountNumber ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Payment history is kept for records. Pending overpayment
                    alerts will be cleared.
                  </p>
                </div>

                {hasPendingRefunds ? (
                  <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                    Settle pending refunds first — deactivation is blocked until
                    they clear.
                  </div>
                ) : null}

                <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    disabled={deactivate.isPending}
                    className="order-2 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm font-medium text-text-primary shadow-sm transition hover:bg-white disabled:opacity-60 sm:order-1"
                  >
                    Keep active
                  </button>
                  <button
                    type="button"
                    onClick={handleDeactivate}
                    disabled={deactivate.isPending || hasPendingRefunds}
                    className="order-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(220,38,38,0.28)] transition hover:bg-red-700 disabled:opacity-60 sm:order-2"
                  >
                    {deactivate.isPending ? "Expiring VA…" : "End partnership"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <AppShell title={partner.fullName}>
      {isInactive ? (
        <div className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-sm text-text-secondary">
          This member left the partnership program. Their Nomba virtual account
          is expired, so new transfers should no longer land here. Payment
          history is kept for records.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-primary">Dedicated account number</p>
            <StatusBadge status={partnerStatus} />
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-text-primary">
            {partner.virtualAccountNumber ?? "—"}
          </p>
          <p className="mt-3 text-sm text-text-secondary">
            {partner.bankName} · {partner.bankAccountName}
          </p>
          {!isInactive ? (
            <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm text-text-primary">
              Pay{" "}
              <span className="font-semibold text-primary">
                {formatMoney(partner.installmentAmount ?? partner.monthlyCommitment)}
              </span>{" "}
              {partner.frequencyLabel ?? "every month"} to this account.
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm text-text-secondary">
              Account expired — no longer accepting partnership payments.
            </p>
          )}
          {partner.nombaVaStatus && (
            <p className="mt-3 text-xs font-medium text-text-secondary">
              Nomba VA verify:{" "}
              {partner.nombaVaStatus.verified
                ? partner.nombaVaStatus.expired || isInactive
                  ? "Expired on Nomba"
                  : "Active on Nomba"
                : "Could not verify"}
            </p>
          )}
        </div>

        <div className="card p-6">
          <p className="text-sm font-medium text-text-secondary">Payment plan</p>

          <div className="mt-4 rounded-2xl border border-white/60 bg-white/35 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Total agreed
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
                  {formatMoney(partner.pledgeTotal ?? partner.monthlyCommitment)}
                </p>
              </div>
              {partner.pledgeComplete ? (
                <StatusBadge status="paid" />
              ) : (
                <span className="rounded-full bg-primary-muted px-2.5 py-1 text-xs font-medium text-primary">
                  {partner.progressPercent ?? 0}% paid
                </span>
              )}
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, partner.progressPercent ?? 0)}%` }}
              />
            </div>

            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              {partner.planSummary ??
                `${formatMoney(partner.monthlyCommitment)} every month`}
            </p>
          </div>

          <div className="mt-4 divide-y divide-border">
            <Row label="Phone" value={partner.phone} />
            <Row
              label="Each payment"
              value={formatMoney(partner.installmentAmount ?? partner.monthlyCommitment)}
            />
            <Row
              label="How often"
              value={partner.frequencyShortLabel ?? "Monthly"}
            />
            <Row
              label="Payments left to finish"
              value={
                partner.pledgeComplete
                  ? "Completed"
                  : formatMoney(partner.remainingPledge ?? 0)
              }
            />
            <Row
              label="Paid so far"
              value={formatMoney(partner.paidTowardPledge ?? 0)}
            />
            <Row
              label="Expected this month"
              value={formatMoney(partner.expectedThisMonth ?? partner.monthlyCommitment)}
            />
            <Row
              label="Starts paying from"
              value={partner.partnershipStartLabel ?? "—"}
            />
            <Row
              label="Behind on months"
              value={
                partner.arrears > 0 ? (
                  <span className="font-semibold text-danger">{formatMoney(partner.arrears)}</span>
                ) : (
                  <span className="font-medium text-green-600">None</span>
                )
              }
            />
            <Row label="Extra credit" value={formatMoney(partner.creditBalance)} />
            <Row label="Partnership status" value={<StatusBadge status={partnerStatus} />} />
          </div>

          {!isInactive ? (
            <div className="mt-6 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="btn-secondary w-full border-red-200 text-red-700 hover:bg-red-50"
              >
                End partnership & expire VA
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {hasOverpayments && <OverpaymentsPanel overpayments={partner.overpayments} />}

      <MonthlyLedgerPanel months={partner.months} />

      <PaymentHistoryPanel payments={partner.payments} />

      {modal}
    </AppShell>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
