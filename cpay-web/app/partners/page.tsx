"use client";

import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PartnersTable } from "@/components/partners/PartnersTable";
import {
  EmptyState,
  PageSection,
  PartnersTableSkeleton,
} from "@/components/shared/ui";
import { DEMO_PARTNERS } from "@/data/demoPartners";
import { usePartners } from "@/hooks/useCpay";
import type { PartnerDisplayItem } from "@/types";

export default function PartnersPage() {
  const { data: livePartners, isLoading } = usePartners();

  const liveRows: PartnerDisplayItem[] = (livePartners ?? []).map((p) => ({
    ...p,
    isSimulated: false,
  }));

  const allMembers: PartnerDisplayItem[] = [...liveRows, ...DEMO_PARTNERS];

  return (
    <AppShell title="Partnership members">
      {/* <div className="rounded-2xl border border-violet-200/80 bg-violet-500/5 px-5 py-4 text-sm text-violet-950">
        <p className="font-semibold">Live vs simulated members</p>
        <p className="mt-1 text-violet-800/90">
          <span className="font-medium text-emerald-800">Live</span> rows are real
          partners from the Nomba API (sandbox allows 2 virtual accounts).{" "}
          <span className="font-medium text-text-secondary">Simulated</span> rows
          preview how CPay scales for a 500-member church — payments and webhooks
          are not real for those members.
        </p>
      </div> */}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatPill label="Live (Nomba API)" value={liveRows.length} tone="live" />
        <StatPill label="Simulated preview" value={DEMO_PARTNERS.length} tone="demo" />
        <StatPill label="Total shown" value={allMembers.length} tone="total" />
      </div>

      <PageSection
        title="All partnership members"
        description="Dedicated virtual account per member — finance sees who paid, who missed, and who has outstanding balances."
        actions={
          <Link href="/partners/new" className="btn-primary">
            + Add partner
          </Link>
        }
      >
        {isLoading ? (
          <PartnersTableSkeleton rows={4} />
        ) : liveRows.length === 0 && allMembers.length === DEMO_PARTNERS.length ? (
          <EmptyState
            title="No live members yet"
            description="Add a partner to provision a Nomba virtual account. Simulated previews still appear below for demo scale."
            actionHref="/partners/new"
            actionLabel="Add first partner"
          />
        ) : (
          <PartnersTable partners={allMembers} />
        )}
      </PageSection>
    </AppShell>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "live" | "demo" | "total";
}) {
  const styles = {
    live: "border-emerald-200/80 bg-emerald-500/5",
    demo: "border-slate-200/80 bg-white/30",
    total: "border-primary/20 bg-primary-subtle",
  };

  return (
    <div className={`card px-4 py-3 ${styles[tone]}`}>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}
