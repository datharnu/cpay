"use client";

import { use } from "react";
import { AppShell, formatMoney } from "@/components/shared/AppShell";
import {
  MonthlyLedgerPanel,
  OverpaymentsPanel,
  PaymentHistoryPanel,
} from "@/components/partners/PartnerDetailPanels";
import { usePartner } from "@/hooks/useCpay";

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: partner, isLoading } = usePartner(id);

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

  const hasOverpayments = partner.overpayments.length > 0;

  return (
    <AppShell title={partner.fullName}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm font-medium text-primary">Dedicated account number</p>
          <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-text-primary">
            {partner.virtualAccountNumber ?? "—"}
          </p>
          <p className="mt-3 text-sm text-text-secondary">
            {partner.bankName} · {partner.bankAccountName}
          </p>
          <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm text-text-primary">
            Pay <span className="font-semibold text-primary">{formatMoney(partner.monthlyCommitment)}</span> monthly to this account.
          </p>
          {partner.nombaVaStatus && (
            <p className="mt-3 text-xs font-medium text-text-secondary">
              Nomba VA verify:{" "}
              {partner.nombaVaStatus.verified
                ? partner.nombaVaStatus.expired
                  ? "Expired on Nomba"
                  : "Active on Nomba"
                : "Could not verify"}
            </p>
          )}
        </div>

        <div className="card p-6">
          <p className="text-sm font-medium text-text-secondary">Summary</p>
          <div className="mt-4 divide-y divide-border">
            <Row label="Phone" value={partner.phone} />
            <Row label="Monthly commitment" value={formatMoney(partner.monthlyCommitment)} />
            <Row
              label="Starts paying from"
              value={partner.partnershipStartLabel ?? "—"}
            />
            <Row
              label="Outstanding"
              value={
                partner.arrears > 0 ? (
                  <span className="font-semibold text-danger">{formatMoney(partner.arrears)}</span>
                ) : (
                  <span className="font-medium text-green-600">None</span>
                )
              }
            />
            <Row label="Credit balance" value={formatMoney(partner.creditBalance)} />
          </div>
        </div>
      </div>

      {hasOverpayments && <OverpaymentsPanel overpayments={partner.overpayments} />}

      <MonthlyLedgerPanel months={partner.months} />

      <PaymentHistoryPanel payments={partner.payments} />
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
