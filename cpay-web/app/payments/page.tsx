"use client";

import { AppShell } from "@/components/shared/AppShell";
import { PageSection } from "@/components/shared/ui";
import { PaymentsTable } from "@/components/partners/PaymentsTable";
import { PaymentExportAction } from "@/components/partners/PaymentExportBar";
import { useAllPayments } from "@/hooks/useCpay";

export default function PaymentsPage() {
  const { data: payments, isLoading } = useAllPayments();

  return (
    <AppShell title="Payment history">
      <PageSection
        flush
        title="All partnership payments"
        description="Every reconciled transfer across all members — newest first. Click a member to open their profile."
        actions={
          <PaymentExportAction scopeLabel="all partnership members" />
        }
      >
        {isLoading ? (
          <div className="space-y-3 px-5 py-6">
            <div className="h-10 animate-pulse rounded-lg bg-white/25" />
            <div className="h-10 animate-pulse rounded-lg bg-white/25" />
            <div className="h-10 animate-pulse rounded-lg bg-white/25" />
          </div>
        ) : (
          <PaymentsTable payments={payments ?? []} showMember />
        )}
      </PageSection>
    </AppShell>
  );
}
