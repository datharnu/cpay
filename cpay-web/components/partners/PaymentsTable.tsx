"use client";

import Link from "next/link";
import { formatMoney, StatusBadge } from "@/components/shared/AppShell";

export type PaymentTableRow = {
  id: string;
  amount: number;
  classification?: string | null;
  senderName?: string | null;
  nombaTransactionId?: string | null;
  createdAt: string;
  partnerId?: string | null;
  partnerName?: string | null;
  virtualAccountNumber?: string | null;
};

function formatPaymentDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function PaymentsTable({
  payments,
  showMember = false,
}: {
  payments: PaymentTableRow[];
  showMember?: boolean;
}) {
  if (payments.length === 0) {
    return (
      <p className="px-5 py-8 text-text-secondary">
        No payments recorded yet. Transfers appear here when Nomba webhooks reconcile.
      </p>
    );
  }

  const sorted = [...payments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="overflow-x-auto">
      <table className="detail-table w-full min-w-[800px]">
        <thead>
          <tr>
            <th>Received</th>
            {showMember ? <th>Member</th> : null}
            <th>Amount</th>
            <th>Transfer from</th>
            <th>Classification</th>
            {showMember ? <th>Account</th> : null}
            <th>Payment ID</th>
            <th>Nomba reference</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((payment) => {
            const { date, time } = formatPaymentDateTime(payment.createdAt);

            return (
              <tr key={payment.id}>
                <td>
                  <p className="font-medium text-text-primary">{date}</p>
                  <p className="text-xs text-text-muted">{time}</p>
                </td>
                {showMember ? (
                  <td>
                    {payment.partnerId && payment.partnerName ? (
                      <Link
                        href={`/partners/${payment.partnerId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {payment.partnerName}
                      </Link>
                    ) : (
                      <span className="text-text-muted">Unmatched</span>
                    )}
                  </td>
                ) : null}
                <td className="font-bold tabular-nums">{formatMoney(payment.amount)}</td>
                <td>
                  <p className="font-medium">{payment.senderName ?? "Unknown sender"}</p>
                  <p className="text-xs text-text-muted">Bank transfer</p>
                </td>
                <td>
                  {payment.classification ? (
                    <StatusBadge status={payment.classification} />
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>
                {showMember ? (
                  <td>
                    <span className="font-mono text-xs text-text-secondary">
                      {payment.virtualAccountNumber ?? "—"}
                    </span>
                  </td>
                ) : null}
                <td>
                  <span className="font-mono text-xs text-text-secondary" title={payment.id}>
                    {shortId(payment.id)}
                  </span>
                </td>
                <td>
                  {payment.nombaTransactionId ? (
                    <span
                      className="font-mono text-xs text-text-secondary"
                      title={payment.nombaTransactionId}
                    >
                      {shortId(payment.nombaTransactionId)}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
