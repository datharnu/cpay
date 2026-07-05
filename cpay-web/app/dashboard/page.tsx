"use client";

import Link from "next/link";
import { AppShell, formatMoney } from "@/components/shared/AppShell";
import { DashboardCollectionsChart } from "@/components/dashboard/DashboardCollectionsChart";
import { DashboardOverviewSkeleton } from "@/components/dashboard/DashboardOverviewSkeleton";
import { PaymentsTable } from "@/components/partners/PaymentsTable";
import { PartnersTable } from "@/components/partners/PartnersTable";
import {
  AlertListItem,
  AlertSection,
  EmptyState,
  LiveBadge,
  PageSection,
  PartnersTableSkeleton,
  StatCard,
} from "@/components/shared/ui";
import { useDashboardSummary, usePartners } from "@/hooks/useCpay";

export default function DashboardPage() {
  const { data: summary, isPending: summaryPending, dataUpdatedAt } = useDashboardSummary();
  const { data: partners, isLoading: partnersLoading } = usePartners();

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-NG")
    : null;

  const recentPaymentRows = (summary?.recentPayments ?? []).slice(0, 4).map((p) => ({
    id: p.id,
    amount: p.amount,
    classification: p.classification,
    senderName: p.senderName,
    nombaTransactionId: p.nombaTransactionId,
    createdAt: p.createdAt,
    partnerId: p.partnerId,
    partnerName: p.partnerName,
    virtualAccountNumber: p.virtualAccountNumber,
  }));

  if (summaryPending) {
    return (
      <AppShell title="Dashboard Overview">
        <DashboardOverviewSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard Overview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Live webhook reconciliation
          {lastUpdated ? ` · updated ${lastUpdated}` : null}
        </p>
        <LiveBadge label="Live via Nomba webhooks" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Nomba wallet (live)"
          value={
            summary?.nombaWalletBalance == null
              ? "—"
              : formatMoney(summary.nombaWalletBalance)
          }
          tone="info"
          hint={
            summary?.nombaWalletError
              ? "Could not reach Nomba"
              : "Exact money left in Nomba right now"
          }
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
            </svg>
          }
        />
        <StatCard
          label="Total recorded"
          value={formatMoney(summary?.totalCollected ?? 0)}
          tone="success"
          hint={`${summary?.totalPayments ?? 0} payment${summary?.totalPayments === 1 ? "" : "s"} in CPay`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <StatCard
          label="Collected this month"
          value={formatMoney(summary?.collectedThisMonth ?? 0)}
          tone="info"
          hint={`${summary?.collectionRate ?? 0}% of expected`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.375M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          }
        />
        <StatCard
          label="Expected this month"
          value={formatMoney(summary?.expectedThisMonth ?? 0)}
          tone="default"
          hint={`${summary?.membersPaidThisMonth ?? 0}/${summary?.membersTrackedThisMonth ?? 0} members fully paid`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          }
        />
        <StatCard
          label="Outstanding"
          value={formatMoney(summary?.totalArrears ?? 0)}
          tone={(summary?.totalArrears ?? 0) > 0 ? "danger" : "success"}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          }
        />
        <StatCard
          label="Partners"
          value={String(summary?.totalPartners ?? 0)}
          hint={`${summary?.activePartners ?? 0} active`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766m12.748 0c-.995.608-2.085.96-3.228 1.066M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          }
        />
        {(summary?.pendingOverpayments ?? 0) > 0 && summary?.recentOverpayments[0] ? (
          <Link
            href={`/partners/${summary.recentOverpayments[0].partnerId}`}
            className="block h-full rounded-2xl transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50"
          >
            <StatCard
              label="Overpayments"
              value={String(summary.pendingOverpayments)}
              tone="warning"
              hint="Tap to resolve"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              }
            />
          </Link>
        ) : (
          <StatCard
            label="Overpayments"
            value={String(summary?.pendingOverpayments ?? 0)}
            tone="success"
            hint="No excess awaiting decision"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
        )}
      </div>

      {summary?.nombaWalletError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load Nomba live balance: {summary.nombaWalletError}
        </div>
      ) : null}

      <PageSection
        title="Collections overview"
        description="Expected vs collected from the monthly ledger. Future months appear automatically when overpayment credit is applied."
      >
        <DashboardCollectionsChart
          months6={summary?.monthlyCollections6 ?? summary?.monthlyCollections ?? []}
          months12={summary?.monthlyCollections12 ?? []}
          isLoading={false}
        />
      </PageSection>

      {(summary?.pendingRefunds ?? 0) > 0 && (
        <AlertSection
          title="Refunds pending Nomba settlement"
          description="Transfer initiated via Nomba — marked complete only when Nomba confirms settlement."
          tone="warning"
        >
          <ul className="space-y-2">
            {summary?.recentPendingRefunds.map((item) => (
              <AlertListItem
                key={item.id}
                href={`/partners/${item.partnerId}`}
                actionLabel="Check status"
                actionTone="warning"
              >
                <p className="font-medium text-text-primary">{item.partnerName}</p>
                <p className="text-text-secondary">
                  {formatMoney(item.excess)} → {item.refundAccountName ?? "bank"} (
                  {item.refundAccountNumber ?? "—"})
                </p>
                {item.merchantTxRef && (
                  <p className="font-mono text-xs text-text-muted">{item.merchantTxRef}</p>
                )}
              </AlertListItem>
            ))}
          </ul>
        </AlertSection>
      )}

      <PageSection
        flush
        title="Recent payments"
        description="Latest transfers reconciled across all members."
        actions={
          <Link href="/payments" className="btn-secondary text-xs sm:text-sm">
            View all payments
          </Link>
        }
      >
        <PaymentsTable payments={recentPaymentRows} showMember />
      </PageSection>

      <PageSection
        title="Partnership members"
        description="Live Nomba virtual accounts — click a row to open member details."
        actions={
          <Link href="/partners/new" className="btn-primary">
            + Add partner
          </Link>
        }
      >
        {partnersLoading ? (
          <PartnersTableSkeleton rows={2} />
        ) : !partners?.length ? (
          <EmptyState
            title="No members yet"
            description="Add a partner to provision a dedicated Nomba virtual account for them."
            actionHref="/partners/new"
            actionLabel="Add first partner"
          />
        ) : (
          <>
            <PartnersTable partners={partners} />
            <p className="mt-4 text-center text-sm text-text-secondary">
              Showing {partners.length} member{partners.length === 1 ? "" : "s"}.{" "}
              <Link href="/partners" className="font-medium text-primary hover:underline">
                View all members →
              </Link>
            </p>
          </>
        )}
      </PageSection>
    </AppShell>
  );
}
