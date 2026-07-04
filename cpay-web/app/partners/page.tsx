"use client";

import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { PartnersTable } from "@/components/partners/PartnersTable";
import {
  EmptyState,
  PageSection,
  PartnersTableSkeleton,
} from "@/components/shared/ui";
import { usePartners } from "@/hooks/useCpay";

export default function PartnersPage() {
  const { data: partners, isLoading } = usePartners();

  return (
    <AppShell title="Partnership members">
      <PageSection
        flush
        title="All partnership members"
        description="Each member has a dedicated Nomba virtual account — finance sees who paid, who missed, and who has outstanding balances."
        actions={
          <Link href="/partners/new" className="btn-primary">
            + Add partner
          </Link>
        }
      >
        {isLoading ? (
          <PartnersTableSkeleton rows={4} />
        ) : !partners?.length ? (
          <EmptyState
            title="No members yet"
            description="Add a partner to provision a Nomba virtual account."
            actionHref="/partners/new"
            actionLabel="Add first partner"
          />
        ) : (
          <PartnersTable partners={partners} />
        )}
      </PageSection>
    </AppShell>
  );
}
