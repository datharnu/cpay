"use client";

import { useEffect, useState } from "react";
import { PageSection, PartnersTableSkeleton } from "@/components/shared/ui";

const BOOT_STEPS = [
  {
    id: "api",
    label: "Waking up live API",
    detail: "Render free tier may take up to a minute on first visit",
  },
  {
    id: "nomba",
    label: "Connecting to Nomba",
    detail: "Authenticating with hackathon live credentials",
  },
  {
    id: "ledger",
    label: "Loading partnership ledger",
    detail: "Syncing members, payments, and wallet balance",
  },
] as const;

function SkeletonBar({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton-shimmer rounded-lg bg-white/25 ${className}`}
      style={style}
      aria-hidden
    />
  );
}

function StatCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="card flex h-full min-h-[7.5rem] flex-col gap-3 p-4 sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-9 w-9 shrink-0 rounded-xl" />
      </div>
      <SkeletonBar className="h-8 w-28" />
      <SkeletonBar className="h-2.5 w-32" />
    </div>
  );
}

function BootStatusBanner({ activeStep }: { activeStep: number }) {
  return (
    <div className="card overflow-hidden border border-primary/20">
      <div className="relative px-5 py-5 sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-2xl bg-primary/15" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-muted text-primary shadow-card">
              <svg className="h-7 w-7 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Live demo loading
            </p>
            <h2 className="mt-1 text-lg font-bold text-text-primary sm:text-xl">
              Connecting to your Nomba-backed finance dashboard
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
              The backend runs on Render&apos;s free tier and sleeps when idle. It&apos;s
              waking up now — real virtual accounts and webhook data will appear in a
              moment.
            </p>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/30">
              <div className="dashboard-boot-progress h-full rounded-full bg-gradient-to-r from-primary via-violet-400 to-primary" />
            </div>

            <ul className="mt-5 space-y-2.5">
              {BOOT_STEPS.map((step, index) => {
                const done = index < activeStep;
                const active = index === activeStep;

                return (
                  <li
                    key={step.id}
                    className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                      active
                        ? "border-primary/30 bg-primary-subtle"
                        : done
                          ? "border-emerald-200/60 bg-emerald-500/5"
                          : "border-white/40 bg-white/15"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        done
                          ? "bg-emerald-500/15 text-emerald-700"
                          : active
                            ? "bg-primary/15 text-primary"
                            : "bg-white/30 text-text-muted"
                      }`}
                    >
                      {done ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : active ? (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          active || done ? "text-text-primary" : "text-text-muted"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-text-muted">{step.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsTableSkeleton() {
  return (
    <div className="space-y-3 px-5 py-6" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-4 rounded-xl border border-white/35 bg-white/15 px-4 py-3.5"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <SkeletonBar className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBar className="h-3.5 w-36" />
            <SkeletonBar className="h-2.5 w-52" />
          </div>
          <SkeletonBar className="h-6 w-20 rounded-full" />
          <SkeletonBar className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4">
          <SkeletonBar className="h-3 w-24" />
          <SkeletonBar className="h-3 w-20" />
        </div>
        <SkeletonBar className="h-8 w-36 rounded-lg" />
      </div>
      <div className="mt-2 flex gap-2">
        <div className="flex w-11 shrink-0 flex-col justify-between py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBar key={i} className="h-2 w-8" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-end justify-between gap-2 border-b border-white/30 pb-8 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-end justify-center gap-1" style={{ height: 180 }}>
                <SkeletonBar
                  className="w-[42%] max-w-8 rounded-t-md"
                  style={{ height: `${35 + (i % 3) * 18}%` } as React.CSSProperties}
                />
                <SkeletonBar
                  className="w-[42%] max-w-8 rounded-t-md"
                  style={{ height: `${50 + (i % 4) * 12}%` } as React.CSSProperties}
                />
              </div>
              <SkeletonBar className="h-2.5 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardOverviewSkeleton() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setActiveStep(1), 4000),
      window.setTimeout(() => setActiveStep(2), 12000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading dashboard overview"
    >
      <BootStatusBanner activeStep={activeStep} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonBar className="h-4 w-48" />
        <div className="flex gap-2">
          <SkeletonBar className="h-8 w-36 rounded-md" />
          <SkeletonBar className="h-8 w-40 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <StatCardSkeleton key={i} delay={i * 60} />
        ))}
      </div>

      <PageSection
        title="Collections overview"
        description="Expected vs collected from the monthly ledger."
      >
        <ChartSkeleton />
      </PageSection>

      <PageSection flush title="Recent payments" description="Latest transfers reconciled across all members.">
        <PaymentsTableSkeleton />
      </PageSection>

      <PageSection
        title="Partnership members"
        description="Live Nomba virtual accounts — click a row to open member details."
      >
        <PartnersTableSkeleton rows={3} />
      </PageSection>
    </div>
  );
}
