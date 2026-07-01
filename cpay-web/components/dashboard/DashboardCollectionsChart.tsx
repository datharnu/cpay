"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/components/shared/AppShell";

export type MonthlyCollectionBucket = {
  label: string;
  expected: number;
  collected: number;
  isFuture?: boolean;
  prepaid?: boolean;
};

type ChartRange = 6 | 12;

const PLOT_HEIGHT_PX = 176;
const Y_AXIS_TICKS = 4;

function niceCeiling(value: number) {
  if (value <= 0) return 1;
  if (value <= 1_000) return Math.ceil(value / 100) * 100 || 100;
  if (value <= 10_000) return Math.ceil(value / 1_000) * 1_000;
  if (value <= 100_000) return Math.ceil(value / 10_000) * 10_000;
  if (value <= 1_000_000) return Math.ceil(value / 100_000) * 100_000;
  return Math.ceil(value / 500_000) * 500_000;
}

function formatAxisLabel(amount: number) {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `₦${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (amount >= 1_000) return `₦${Math.round(amount / 1_000)}k`;
  return formatMoney(amount);
}

function buildYAxisTicks(maxValue: number) {
  const ceiling = niceCeiling(maxValue * 1.05);
  return Array.from({ length: Y_AXIS_TICKS + 1 }, (_, i) =>
    Math.round((ceiling / Y_AXIS_TICKS) * i)
  );
}

function barHeightPct(value: number, tickMax: number) {
  if (value <= 0 || tickMax <= 0) return 0;
  return Math.max(3, (value / tickMax) * 100);
}

export function DashboardCollectionsChart({
  months6,
  months12,
  isLoading,
}: {
  months6: MonthlyCollectionBucket[];
  months12: MonthlyCollectionBucket[];
  isLoading?: boolean;
}) {
  const [range, setRange] = useState<ChartRange>(6);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const months = range === 12 ? months12 : months6;

  const maxValue = Math.max(
    ...months.flatMap((m) => [m.expected, m.collected]),
    1
  );

  const yTicks = useMemo(() => buildYAxisTicks(maxValue), [maxValue]);
  const tickMax = yTicks[yTicks.length - 1] ?? maxValue;
  const yTicksDesc = [...yTicks].reverse();

  if (isLoading) {
    return (
      <div>
        <RangeToggle range={range} onChange={setRange} disabled />
        <ChartFrame yTicks={yTicksDesc} tickMax={tickMax}>
          {Array.from({ length: range }).map((_, i) => (
            <div key={i} className="flex min-w-[2.75rem] flex-1 flex-col items-center gap-2">
              <div className="h-32 w-full animate-pulse rounded-t-lg bg-white/25" />
              <div className="h-3 w-10 animate-pulse rounded bg-white/20" />
            </div>
          ))}
        </ChartFrame>
      </div>
    );
  }

  if (months.every((m) => m.expected === 0 && m.collected === 0)) {
    return (
      <div>
        <RangeToggle range={range} onChange={setRange} />
        <div className="mt-4 flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-white/45 bg-white/10 px-6 text-center">
          <p className="text-sm font-medium text-text-primary">No collection data yet</p>
          <p className="mt-1 max-w-sm text-xs text-text-muted">
            When members pay into their Nomba virtual accounts — or finance applies
            overpayment credit to future months — bars will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-2 text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
            Collected (ledger)
          </span>
          <span className="flex items-center gap-2 text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-sm border border-slate-500/60 bg-slate-500/35" />
            Expected
          </span>
          <span className="flex items-center gap-2 text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 ring-1 ring-emerald-600/40" />
            Pre-paid (credit)
          </span>
        </div>
        <RangeToggle range={range} onChange={setRange} />
      </div>

      <ChartFrame yTicks={yTicksDesc} tickMax={tickMax}>
        {months.map((month, index) => {
          const collectedPct = barHeightPct(month.collected, tickMax);
          const expectedPct = barHeightPct(month.expected, tickMax);
          const isHovered = hoveredIndex === index;
          const collectedClass = month.prepaid
            ? "bg-emerald-500 ring-1 ring-emerald-700/30"
            : "bg-primary shadow-sm";

          return (
            <div
              key={`${month.label}-${month.isFuture ? "f" : "p"}`}
              className="relative flex min-w-[2.75rem] flex-1 flex-col items-center gap-2"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
            >
              {isHovered ? (
                <div
                  className="pointer-events-none absolute bottom-[calc(100%-0.25rem)] left-1/2 z-20 min-w-[9.5rem] -translate-x-1/2 rounded-xl border border-white/70 bg-[#1a1825]/95 px-3 py-2 text-left text-white shadow-[0_12px_32px_rgba(26,24,37,0.35)]"
                  role="tooltip"
                >
                  <p className="text-[11px] font-semibold text-white/90">{month.label}</p>
                  <div className="mt-1.5 space-y-1 text-[11px]">
                    <p className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Collected</span>
                      <span className="font-semibold tabular-nums">{formatMoney(month.collected)}</span>
                    </p>
                    <p className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Expected</span>
                      <span className="font-semibold tabular-nums">{formatMoney(month.expected)}</span>
                    </p>
                    {month.prepaid ? (
                      <p className="pt-0.5 text-[10px] font-medium text-emerald-300">Pre-paid via overpayment credit</p>
                    ) : null}
                  </div>
                  <span className="absolute left-1/2 top-full -mt-px block h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/70 bg-[#1a1825]/95" />
                </div>
              ) : null}

              <div
                className="flex w-full items-end justify-center gap-1 sm:gap-1.5"
                style={{ height: PLOT_HEIGHT_PX }}
              >
                <div
                  className={`w-[42%] max-w-8 rounded-t-md transition-all duration-200 ${collectedClass} ${
                    isHovered ? "brightness-110 scale-y-[1.02] origin-bottom" : ""
                  }`}
                  style={{ height: `${collectedPct}%` }}
                  aria-label={`Collected ${formatMoney(month.collected)}`}
                />
                <div
                  className={`w-[42%] max-w-8 rounded-t-md border border-slate-500/50 bg-slate-500/35 transition-all duration-200 ${
                    isHovered ? "brightness-110 scale-y-[1.02] origin-bottom bg-slate-500/50" : ""
                  }`}
                  style={{ height: `${expectedPct}%` }}
                  aria-label={`Expected ${formatMoney(month.expected)}`}
                />
              </div>

              <div className="text-center">
                <p
                  className={`text-[11px] font-semibold ${
                    month.isFuture ? "text-emerald-800" : "text-text-primary"
                  } ${isHovered ? "text-primary" : ""}`}
                >
                  {month.label}
                </p>
                <p className="text-[10px] tabular-nums text-text-muted">
                  {formatMoney(month.collected)}
                </p>
                {month.prepaid ? (
                  <p className="text-[9px] font-medium text-emerald-700">Pre-paid</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </ChartFrame>
    </div>
  );
}

function ChartFrame({
  yTicks,
  tickMax,
  children,
}: {
  yTicks: number[];
  tickMax: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex gap-2 sm:gap-3">
      <div
        className="relative w-11 shrink-0 sm:w-12"
        style={{ height: PLOT_HEIGHT_PX }}
        aria-hidden
      >
        {yTicks.map((tick) => {
          const bottomPct = tickMax > 0 ? (tick / tickMax) * 100 : 0;
          return (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[10px] font-medium leading-none tabular-nums text-text-muted sm:text-[11px]"
              style={{ bottom: `${bottomPct}%` }}
            >
              {formatAxisLabel(tick)}
            </span>
          );
        })}
      </div>

      <div className="relative min-w-0 flex-1 overflow-x-auto pb-1">
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: PLOT_HEIGHT_PX }}
          aria-hidden
        >
          {yTicks.map((tick) => {
            const bottomPct = tickMax > 0 ? (tick / tickMax) * 100 : 0;
            return (
              <div
                key={tick}
                className="absolute left-0 right-0 border-t border-white/45"
                style={{ bottom: `${bottomPct}%` }}
              />
            );
          })}
        </div>

        <div className="relative flex items-end justify-between gap-1 sm:gap-2">{children}</div>
      </div>
    </div>
  );
}

function RangeToggle({
  range,
  onChange,
  disabled,
}: {
  range: ChartRange;
  onChange: (r: ChartRange) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/50 bg-white/20 p-0.5 text-xs">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(6)}
        className={`rounded-md px-3 py-1.5 font-medium transition ${
          range === 6
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        6 months
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(12)}
        className={`rounded-md px-3 py-1.5 font-medium transition ${
          range === 12
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        12 months
      </button>
    </div>
  );
}
