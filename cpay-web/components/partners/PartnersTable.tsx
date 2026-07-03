"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, StatusBadge } from "@/components/shared/AppShell";
import type { PartnerDisplayItem } from "@/types";

export function SimulatedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-slate-400/60 bg-white/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted backdrop-blur-sm">
      Simulated
    </span>
  );
}

export function LiveBadgePill() {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
      Live
    </span>
  );
}

export function PartnersTable({ partners }: { partners: PartnerDisplayItem[] }) {
  const router = useRouter();

  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Source</th>
            <th>Dedicated account</th>
            <th>Payment plan</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {partners.map((partner) => {
            const rowMuted = partner.isSimulated;
            const detailHref = `/partners/${partner.id}`;

            const openDetail = () => {
              if (!partner.isSimulated) {
                router.push(detailHref);
              }
            };

            return (
              <tr
                key={partner.id}
                onClick={openDetail}
                onKeyDown={(event) => {
                  if (!partner.isSimulated && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    openDetail();
                  }
                }}
                tabIndex={partner.isSimulated ? undefined : 0}
                role={partner.isSimulated ? undefined : "link"}
                className={
                  rowMuted
                    ? "bg-white/10 opacity-90"
                    : "cursor-pointer hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50"
                }
              >
                <td className="font-medium">
                  <div className="flex flex-col gap-1">
                    <span>{partner.fullName}</span>
                    {partner.isSimulated ? (
                      <span className="text-xs font-normal text-text-muted">
                        Preview member — not a real Nomba account
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  {partner.isSimulated ? <SimulatedBadge /> : <LiveBadgePill />}
                </td>
                <td>
                  <span
                    className={`inline-flex rounded-md px-2 py-1 font-mono text-xs font-medium ${
                      partner.isSimulated
                        ? "border border-dashed border-slate-300/80 bg-white/30 text-text-muted"
                        : "bg-primary-subtle text-primary"
                    }`}
                  >
                    {partner.virtualAccountNumber ?? "—"}
                  </span>
                </td>
                <td className="text-text-secondary">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-text-primary">
                      {formatMoney(
                        partner.installmentAmount ?? partner.monthlyCommitment
                      )}
                    </span>
                    <span className="text-xs text-text-muted">
                      {partner.frequencyShortLabel ?? "Monthly"}
                      {partner.pledgeTotal
                        ? ` · ${formatMoney(partner.pledgeTotal)} total`
                        : ""}
                    </span>
                  </div>
                </td>
                <td>
                  {partner.arrears > 0 ? (
                    <span className="font-semibold text-danger">
                      {formatMoney(partner.arrears)}
                    </span>
                  ) : (
                    <span className="font-medium text-green-600">Up to date</span>
                  )}
                </td>
                <td>
                  {partner.status === "inactive" ? (
                    <StatusBadge status="inactive" />
                  ) : partner.monthsMissed > 0 ? (
                    <StatusBadge status="missed" />
                  ) : partner.arrears > 0 ? (
                    <StatusBadge status="partial" />
                  ) : (
                    <StatusBadge status="paid" />
                  )}
                </td>
                <td className="text-right">
                  {partner.isSimulated ? (
                    <span className="text-xs text-text-muted">Preview only</span>
                  ) : (
                    <Link
                      href={detailHref}
                      onClick={(event) => event.stopPropagation()}
                      className="font-medium text-primary hover:text-primary-hover"
                    >
                      View →
                    </Link>
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
