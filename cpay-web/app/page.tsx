"use client";

import Link from "next/link";
import { AppShell, formatMoney } from "@/components/shared/AppShell";
import { DashboardCollectionsChart } from "@/components/dashboard/DashboardCollectionsChart";
import { PaymentsTable } from "@/components/partners/PaymentsTable";
import { PartnersTable } from "@/components/partners/PartnersTable";
import { DEMO_PARTNERS } from "@/data/demoPartners";
import {
  AlertListItem,
  AlertSection,
  EmptyState,
  LiveBadge,
  PageSection,
  PartnersTableSkeleton,
  StatCard,
} from "@/components/shared/ui";
import {
  useDashboardSummary,
  useImportMissingNomba,
  usePartners,
  useReconcileNomba,
} from "@/hooks/useCpay";

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading, dataUpdatedAt } = useDashboardSummary();
  const { data: partners, isLoading: partnersLoading } = usePartners();
  const reconcile = useReconcileNomba();
  const importMissing = useImportMissingNomba();

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

  return (
    <AppShell title="Dashboard Overview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Partnership collections via Nomba virtual accounts — live webhook reconciliation.
          {lastUpdated ? ` Updated ${lastUpdated}.` : null}
        </p>
        <LiveBadge label="Live via Nomba webhooks" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total collected"
          value={summaryLoading ? "…" : formatMoney(summary?.totalCollected ?? 0)}
          tone="success"
          hint={
            summaryLoading
              ? undefined
              : `${summary?.totalPayments ?? 0} payment${summary?.totalPayments === 1 ? "" : "s"}`
          }
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <StatCard
          label="Collected this month"
          value={summaryLoading ? "…" : formatMoney(summary?.collectedThisMonth ?? 0)}
          tone="info"
          hint={
            summaryLoading ? undefined : `${summary?.collectionRate ?? 0}% of expected`
          }
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.375M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          }
        />
        <StatCard
          label="Expected this month"
          value={summaryLoading ? "…" : formatMoney(summary?.expectedThisMonth ?? 0)}
          tone="default"
          hint={
            summaryLoading
              ? undefined
              : `${summary?.membersPaidThisMonth ?? 0}/${summary?.membersTrackedThisMonth ?? 0} members fully paid`
          }
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          }
        />
        <StatCard
          label="Outstanding"
          value={summaryLoading ? "…" : formatMoney(summary?.totalArrears ?? 0)}
          tone={(summary?.totalArrears ?? 0) > 0 ? "danger" : "success"}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          }
        />
        <StatCard
          label="Partners"
          value={summaryLoading ? "…" : String(summary?.totalPartners ?? 0)}
          hint={summaryLoading ? undefined : `${summary?.activePartners ?? 0} active`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766m12.748 0c-.995.608-2.085.96-3.228 1.066M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          }
        />
      </div>

      <PageSection
        title="Collections overview"
        description="Expected vs collected from the monthly ledger. Future months appear automatically when overpayment credit is applied."
      >
        <DashboardCollectionsChart
          months6={summary?.monthlyCollections6 ?? summary?.monthlyCollections ?? []}
          months12={summary?.monthlyCollections12 ?? []}
          isLoading={summaryLoading}
        />
      </PageSection>

      {/* {(summary?.pendingOverpayments ?? 0) > 0 && (
        <AlertSection
          title="Awaiting overpayment decision"
          description="Extra amount after monthly dues — apply to next month or refund via Nomba Transfers."
          tone="info"
        >
          <ul className="space-y-2">
            {summary?.recentOverpayments.map((item) => (
              <AlertListItem
                key={item.id}
                href={`/partners/${item.partnerId}`}
                actionLabel="Resolve"
                actionTone="info"
              >
                <p className="font-medium text-text-primary">{item.partnerName}</p>
                <p className="text-text-secondary">
                  Excess {formatMoney(item.excess)} from webhook payment
                </p>
              </AlertListItem>
            ))}
          </ul>
        </AlertSection>
      )} */}

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

      {/* {(summary?.unmatchedPayments ?? 0) > 0 && (
        <AlertSection
          title="Unmatched payments"
          description="Nomba sent a webhook CPay could not link to a member — retry matching or import from Nomba."
          tone="danger"
          actions={
            <button
              type="button"
              onClick={() => reprocessUnmatched.mutate()}
              disabled={reprocessUnmatched.isPending}
              className="btn-secondary"
            >
              {reprocessUnmatched.isPending ? "Retrying…" : "Retry matching"}
            </button>
          }
        >
          <ul className="space-y-2">
            {summary?.recentUnmatched.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl glass-strong px-4 py-3 text-sm shadow-card"
              >
                <div>
                  <span className="font-mono text-xs text-text-muted">
                    {p.virtualAccountNumber ?? "—"}
                  </span>
                  <span className="ml-2 text-text-secondary">Unknown payer</span>
                </div>
                <span className="font-semibold text-red-700">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        </AlertSection>
      )} */}

      {importMissing.isSuccess && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Imported {importMissing.data?.imported ?? 0} payment(s) from Nomba Transactions API.
        </div>
      )}

      {reconcile.isSuccess && reconcile.data && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            reconcile.data.drifts.length > 0
              ? "border-amber-200 bg-warning-bg text-amber-900"
              : "border-green-200 bg-success-bg text-green-900"
          }`}
        >
          {reconcile.data.drifts.length > 0 ? (
            <p>
              Nomba sync found {reconcile.data.drifts.length} drift(s) between Nomba
              Transactions API and local ledger.
            </p>
          ) : (
            <p>
              Nomba sync OK — {reconcile.data.localCount} local payment(s) match Nomba
              transactions.
            </p>
          )}
        </div>
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
        {summaryLoading ? (
          <div className="space-y-3 px-5 py-6">
            <div className="h-10 animate-pulse rounded-lg bg-white/25" />
            <div className="h-10 animate-pulse rounded-lg bg-white/25" />
          </div>
        ) : (
          <PaymentsTable payments={recentPaymentRows} showMember />
        )}
      </PageSection>

      <PageSection
        title="Partnership members"
        description="Live Nomba virtual accounts — click a row to open member details."
        actions={
          <>
            <button
              type="button"
              onClick={() => importMissing.mutate()}
              disabled={importMissing.isPending}
              className="btn-secondary"
            >
              {importMissing.isPending ? "Importing…" : "Import from Nomba"}
            </button>
            <button
              type="button"
              onClick={() => reconcile.mutate()}
              disabled={reconcile.isPending}
              className="btn-secondary"
            >
              {reconcile.isPending ? "Syncing…" : "Sync with Nomba"}
            </button>
            <Link href="/partners/new" className="btn-primary">
              + Add partner
            </Link>
          </>
        }
      >
        {partnersLoading ? (
          <PartnersTableSkeleton rows={2} />
        ) : !partners?.length ? (
          <EmptyState
            title="No members yet"
            description="Add a partner to provision a Nomba virtual account. Sandbox allows up to 2 accounts."
            actionHref="/partners/new"
            actionLabel="Add first partner"
          />
        ) : (
          <>
            <PartnersTable
              partners={partners.map((p) => ({ ...p, isSimulated: false }))}
            />
            <p className="mt-4 text-center text-sm text-text-secondary">
              Showing {partners.length} live member{partners.length === 1 ? "" : "s"}.{" "}
              <Link href="/partners" className="font-medium text-primary hover:underline">
                View all members →
              </Link>{" "}
              for simulated scale preview ({DEMO_PARTNERS.length} demo rows).
            </p>
          </>
        )}
      </PageSection>
    </AppShell>
  );
}
