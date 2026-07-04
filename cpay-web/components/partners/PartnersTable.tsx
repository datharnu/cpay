"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, StatusBadge } from "@/components/shared/AppShell";
import type { PartnerDisplayItem } from "@/types";

export function PartnersTable({ partners }: { partners: PartnerDisplayItem[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Dedicated account</th>
            <th>Payment plan</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {partners.map((partner) => {
            const detailHref = `/partners/${partner.id}`;

            return (
              <tr
                key={partner.id}
                onClick={() => router.push(detailHref)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(detailHref);
                  }
                }}
                tabIndex={0}
                role="link"
                className="cursor-pointer hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50"
              >
                <td className="font-medium">{partner.fullName}</td>
                <td>
                  <span className="inline-flex rounded-md bg-primary-subtle px-2 py-1 font-mono text-xs font-medium text-primary">
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
                  <Link
                    href={detailHref}
                    onClick={(event) => event.stopPropagation()}
                    className="font-medium text-primary hover:text-primary-hover"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
