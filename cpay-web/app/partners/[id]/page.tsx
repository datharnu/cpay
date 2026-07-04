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

  async function handleCopyAccount() {
    const account = partner?.virtualAccountNumber;
    if (!account) return;

    try {
      await navigator.clipboard.writeText(account);
      success("Account number copied — paste in your bank app to pay.");
    } catch {
      toastError("Could not copy. Select the number and copy manually.");
    }
  }

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

  const initials = partner.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const progress = Math.min(100, partner.progressPercent ?? 0);
  const installment = partner.installmentAmount ?? partner.monthlyCommitment;
  const nombaLabel = partner.nombaVaStatus
    ? partner.nombaVaStatus.verified
      ? partner.nombaVaStatus.expired || isInactive
        ? "Expired on Nomba"
        : "Active on Nomba"
      : "Could not verify"
    : null;

  return (
    <AppShell title={partner.fullName}>
      <div className="space-y-6 lg:space-y-8">
      {isInactive ? (
        <div className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-sm text-text-secondary">
          This member left the partnership program. Their Nomba virtual account
          is expired, so new transfers should no longer land here. Payment
          history is kept for records.
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="relative px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-lg font-bold tracking-wide text-white shadow-[0_12px_30px_rgba(99,70,200,0.28)] ring-4 ring-white/50">
                {initials || "P"}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-semibold tracking-tight text-text-primary">
                    {partner.fullName}
                  </h2>
                  <StatusBadge status={partnerStatus} />
                  {nombaLabel ? (
                    <span className="rounded-full bg-white/55 px-2.5 py-1 text-[11px] font-medium text-text-secondary ring-1 ring-white/70">
                      {nombaLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {partner.phone}
                  {partner.partnershipStartLabel
                    ? ` · Starts ${partner.partnershipStartLabel}`
                    : ""}
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  {partner.planSummary ??
                    `${formatMoney(installment)} every month`}
                </p>
              </div>
            </div>

            {!isInactive ? (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="btn-secondary shrink-0 border-red-200 text-red-700 hover:bg-red-50"
              >
                End partnership
              </button>
            ) : null}
          </div>

          <div className="relative mt-5 grid gap-3 lg:grid-cols-[1.35fr_0.85fr] xl:grid-cols-[1.4fr_0.8fr]">
            <div className="rounded-2xl border border-white/70 bg-white/45 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Dedicated account
                </p>
                <span className="rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Nomba VA
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="font-mono text-2xl font-bold tracking-[0.08em] text-text-primary sm:text-3xl">
                  {partner.virtualAccountNumber ?? "—"}
                </p>
                {partner.virtualAccountNumber && !isInactive ? (
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className="btn-secondary shrink-0 px-3 py-1.5 text-xs font-semibold"
                  >
                    Copy number
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                {partner.bankName}
                {partner.bankAccountName ? ` · ${partner.bankAccountName}` : ""}
              </p>
              <div
                className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                  isInactive
                    ? "bg-white/50 text-text-secondary"
                    : "bg-primary-subtle/70 text-text-primary"
                }`}
              >
                {isInactive ? (
                  "Account expired — no longer accepting payments."
                ) : (
                  <>
                    Pay{" "}
                    <span className="font-semibold text-primary">
                      {formatMoney(installment)}
                    </span>{" "}
                    {partner.frequencyLabel ?? "every month"} to this account.
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/45 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
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
                    {progress}% paid
                  </span>
                )}
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniStat
                  label="Paid so far"
                  value={formatMoney(partner.paidTowardPledge ?? 0)}
                />
                <MiniStat
                  label="Left to finish"
                  value={
                    partner.pledgeComplete
                      ? "Done"
                      : formatMoney(partner.remainingPledge ?? 0)
                  }
                />
              </div>
            </div>
          </div>

          <div className="relative mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              label="Each payment"
              value={formatMoney(installment)}
            />
            <MiniStat
              label="How often"
              value={partner.frequencyShortLabel ?? "Monthly"}
            />
            <MiniStat
              label="Expected this month"
              value={formatMoney(
                partner.expectedThisMonth ?? partner.monthlyCommitment
              )}
            />
            <MiniStat
              label="Behind on months"
              value={
                partner.arrears > 0 ? (
                  <span className="text-danger">{formatMoney(partner.arrears)}</span>
                ) : (
                  <span className="text-emerald-700">None</span>
                )
              }
            />
          </div>

          {(partner.creditBalance ?? 0) > 0 ? (
            <p className="relative mt-3 text-xs text-text-secondary">
              Extra credit on file:{" "}
              <span className="font-medium text-text-primary">
                {formatMoney(partner.creditBalance)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {hasOverpayments && <OverpaymentsPanel overpayments={partner.overpayments} />}

      <MonthlyLedgerPanel months={partner.months} />

      <PaymentHistoryPanel
        payments={partner.payments}
        partnerId={partner.id}
        partnerName={partner.fullName}
      />

      {modal}
      </div>
    </AppShell>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/35 px-3.5 py-3 lg:px-4 lg:py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
