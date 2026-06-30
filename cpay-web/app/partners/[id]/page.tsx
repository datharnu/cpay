"use client";

import { use, useState } from "react";
import { AppShell, formatMoney, StatusBadge } from "@/components/shared/AppShell";
import { useToast } from "@/components/shared/Toast";
import { AlertSection, PageSection } from "@/components/shared/ui";
import { usePartner, usePartnerNombaTransactions, useResolveOverpayment, useCheckRefundStatus } from "@/hooks/useCpay";
import type { ResolveOverpaymentInput } from "@/types";

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: partner, isLoading } = usePartner(id);
  const [showNombaTx, setShowNombaTx] = useState(false);
  const nombaTx = usePartnerNombaTransactions(id, showNombaTx);

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

  const pendingOverpayments = partner.overpayments.filter(
    (o) => o.status === "pending_choice"
  );
  const refundPendingOverpayments = partner.overpayments.filter(
    (o) => o.status === "refund_pending"
  );
  const settledOverpayments = partner.overpayments.filter(
    (o) => o.status === "credited" || o.status === "refunded"
  );

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
              label="Arrears"
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

      {pendingOverpayments.length > 0 && (
        <AlertSection
          title="Overpayment — choose action"
          description="Extra amount after monthly dues is held until finance applies it to the next month or refunds the member."
          tone="info"
        >
          <div className="space-y-3">
            {pendingOverpayments.map((item) => (
              <OverpaymentResolveCard key={item.id} caseId={item.id} excess={item.excess} />
            ))}
          </div>
        </AlertSection>
      )}

      {refundPendingOverpayments.length > 0 && (
        <AlertSection
          title="Refund initiated — pending settlement"
          description='Nomba Transfers API accepted the payout. CPay marks "refunded" only after Nomba confirms settlement.'
          tone="warning"
        >
          <div className="space-y-3">
            {refundPendingOverpayments.map((item) => (
              <RefundPendingCard key={item.id} item={item} />
            ))}
          </div>
        </AlertSection>
      )}

      {settledOverpayments.length > 0 && (
        <PageSection title="Resolved overpayments">
          <div className="space-y-3">
            {settledOverpayments.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl glass-subtle px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-text-primary">{formatMoney(item.excess)} excess</p>
                  {item.merchantTxRef && (
                    <p className="font-mono text-xs text-text-muted">{item.merchantTxRef}</p>
                  )}
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </PageSection>
      )}

      {partner.notifications.length > 0 && (
        <PageSection title="Member notifications">
          <div className="space-y-3">
            {partner.notifications.map((n) => (
              <div key={n.id} className="rounded-2xl glass-subtle px-4 py-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-medium text-text-primary">{n.title}</p>
                  <StatusBadge status={n.type} />
                </div>
                <p className="text-sm text-text-secondary">{n.message}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {new Date(n.createdAt).toLocaleString("en-NG")}
                </p>
              </div>
            ))}
          </div>
        </PageSection>
      )}

      <PageSection title="Monthly ledger">
        {partner.months.length === 0 ? (
          <p className="text-text-secondary">No months tracked yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partner.months.map((month) => (
              <div key={`${month.year}-${month.month}`} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium text-text-primary">{month.label}</p>
                  <StatusBadge status={month.status} />
                </div>
                <p className="text-sm text-text-secondary">
                  Paid {formatMoney(month.paid)} of {formatMoney(month.expected)}
                </p>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection
        title="Payment history"
        actions={
          <button
            type="button"
            onClick={() => setShowNombaTx(true)}
            className="btn-secondary text-xs sm:text-sm"
          >
            Load from Nomba API
          </button>
        }
      >
        {!partner.payments.length ? (
          <p className="text-text-secondary">
            No payments yet. Transfers to this account appear here via Nomba webhooks.
          </p>
        ) : (
          <div className="space-y-3">
            {partner.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-2xl glass-subtle px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-text-primary">{formatMoney(payment.amount)}</p>
                  <p className="text-sm text-text-secondary">
                    {payment.senderName ?? "Bank transfer"} ·{" "}
                    {new Date(payment.createdAt).toLocaleString("en-NG")}
                  </p>
                  {payment.nombaTransactionId && (
                    <p className="mt-0.5 font-mono text-xs text-text-muted">
                      Nomba {payment.nombaTransactionId}
                    </p>
                  )}
                </div>
                {payment.classification ? (
                  <StatusBadge status={payment.classification} />
                ) : null}
              </div>
            ))}
          </div>
        )}

        {showNombaTx && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-text-secondary">
              Nomba Transactions API (source of truth)
            </p>
            {nombaTx.isLoading ? (
              <p className="text-sm text-text-muted">Fetching from Nomba…</p>
            ) : !nombaTx.data?.length ? (
              <p className="text-sm text-text-muted">No transactions on Nomba for this VA yet.</p>
            ) : (
              <pre className="max-h-48 overflow-auto rounded-2xl glass-subtle p-4 text-xs">
                {JSON.stringify(nombaTx.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </PageSection>
    </AppShell>
  );
}

function OverpaymentResolveCard({
  caseId,
  excess,
}: {
  caseId: string;
  excess: number;
}) {
  const resolve = useResolveOverpayment();
  const { success, warning } = useToast();
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [bankCode, setBankCode] = useState("999992");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleCredit() {
    const result = await resolve.mutateAsync({
      id: caseId,
      input: { choice: "credit_next_month" },
    });
    const text = result.message ?? "Credited to next month.";
    setMessage(text);
    success(text);
  }

  async function handleRefund(e: React.FormEvent) {
    e.preventDefault();
    const input: ResolveOverpaymentInput = {
      choice: "refund",
      bankCode,
      accountNumber,
      accountName,
    };
    const result = await resolve.mutateAsync({ id: caseId, input });
    const text =
      result.message ??
      `Refund initiated — ${formatMoney(excess)} pending Nomba settlement (sandbox transfers are simulated).`;
    setMessage(text);
    warning(text, 9000);
    setShowRefundForm(false);
  }

  return (
    <div className="rounded-2xl glass-strong px-4 py-3 shadow-card">
      <p className="font-semibold text-text-primary">Excess {formatMoney(excess)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCredit}
          disabled={resolve.isPending}
          className="btn-primary"
        >
          Apply to next month
        </button>
        <button
          type="button"
          onClick={() => setShowRefundForm((v) => !v)}
          disabled={resolve.isPending}
          className="btn-secondary"
        >
          Refund to bank account
        </button>
      </div>

      {showRefundForm && (
        <form onSubmit={handleRefund} className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-xs text-text-muted">
            Nomba bank lookup + transfer (sandbox). Use test bank code 999992 for sandbox.
          </p>
          <input
            className="input-field"
            placeholder="Bank code (e.g. 999992)"
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
          <button type="submit" disabled={resolve.isPending} className="btn-primary">
            {resolve.isPending ? "Initiating…" : `Initiate refund ${formatMoney(excess)}`}
          </button>
        </form>
      )}

      {message && (
        <p className={`mt-3 text-sm ${message.includes("pending") ? "text-amber-800" : "text-green-700"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

function RefundPendingCard({
  item,
}: {
  item: {
    id: string;
    excess: number;
    merchantTxRef?: string | null;
    refundAccountName?: string | null;
    refundAccountNumber?: string | null;
  };
}) {
  const checkRefund = useCheckRefundStatus();
  const { success, info } = useToast();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="rounded-2xl glass-strong p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-amber-900">Excess {formatMoney(item.excess)}</p>
        <StatusBadge status="refund_pending" />
      </div>
      <p className="text-sm text-text-secondary">
        To {item.refundAccountName ?? "bank account"} ({item.refundAccountNumber ?? "—"})
      </p>
      <p className="mt-2 text-xs text-text-muted">
        Sandbox outbound transfers are simulated — no real bank credit until production.
      </p>
      {item.merchantTxRef && (
        <p className="mt-1 font-mono text-xs text-text-muted">Ref: {item.merchantTxRef}</p>
      )}
      <button
        type="button"
        onClick={async () => {
          const result = await checkRefund.mutateAsync(item.id);
          const text = result.message ?? "Status checked.";
          setMessage(text);
          if (text.toLowerCase().includes("settled") || text.toLowerCase().includes("refunded")) {
            success(text);
          } else {
            info(text);
          }
        }}
        disabled={checkRefund.isPending}
        className="btn-primary mt-3 bg-amber-700 hover:bg-amber-800"
      >
        {checkRefund.isPending ? "Checking Nomba…" : "Check settlement status"}
      </button>
      {message && <p className="mt-2 text-sm text-amber-900">{message}</p>}
    </div>
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
