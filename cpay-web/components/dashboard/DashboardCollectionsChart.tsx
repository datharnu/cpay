"use client";

import { formatMoney } from "@/components/shared/AppShell";

export type MonthlyCollectionBucket = {
  label: string;
  expected: number;
  collected: number;
};

export function DashboardCollectionsChart({
  months,
  isLoading,
}: {
  months: MonthlyCollectionBucket[];
  isLoading?: boolean;
}) {
  const maxValue = Math.max(
    ...months.flatMap((m) => [m.expected, m.collected]),
    1
  );

  if (isLoading) {
    return (
      <div className="flex h-56 items-end justify-between gap-3 px-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="h-32 w-full animate-pulse rounded-t-lg bg-white/25" />
            <div className="h-3 w-10 animate-pulse rounded bg-white/20" />
          </div>
        ))}
      </div>
    );
  }

  if (months.every((m) => m.expected === 0 && m.collected === 0)) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-white/45 bg-white/10 px-6 text-center">
        <p className="text-sm font-medium text-text-primary">No collection data yet</p>
        <p className="mt-1 max-w-sm text-xs text-text-muted">
          When members pay into their Nomba virtual accounts, expected vs collected bars
          will appear here month by month.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-2 text-text-secondary">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          Collected
        </span>
        <span className="flex items-center gap-2 text-text-secondary">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/50 ring-1 ring-white/60" />
          Expected
        </span>
      </div>

      <div className="flex h-56 items-end justify-between gap-2 sm:gap-4">
        {months.map((month) => {
          const collectedPct = Math.max(4, (month.collected / maxValue) * 100);
          const expectedPct = Math.max(4, (month.expected / maxValue) * 100);

          return (
            <div
              key={month.label}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <div className="flex h-44 w-full items-end justify-center gap-1 sm:gap-1.5">
                <div
                  className="w-[42%] max-w-8 rounded-t-md bg-primary shadow-sm transition-all"
                  style={{ height: `${collectedPct}%` }}
                  title={`Collected ${formatMoney(month.collected)}`}
                />
                <div
                  className="w-[42%] max-w-8 rounded-t-md bg-white/45 ring-1 ring-white/60 transition-all"
                  style={{ height: `${expectedPct}%` }}
                  title={`Expected ${formatMoney(month.expected)}`}
                />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-text-primary">{month.label}</p>
                <p className="text-[10px] tabular-nums text-text-muted">
                  {formatMoney(month.collected)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
