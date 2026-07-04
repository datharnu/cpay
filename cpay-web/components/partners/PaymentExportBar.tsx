"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  defaultExportFromDate,
  defaultExportToDate,
  downloadPaymentExport,
} from "@/lib/downloadPaymentExport";
import { useToast } from "@/components/shared/Toast";

type DatePreset = {
  id: string;
  label: string;
  from: string;
  to: string;
};

function formatIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildDatePresets(): DatePreset[] {
  const today = new Date();
  const to = formatIsoDate(today);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const last30 = new Date(today);
  last30.setDate(last30.getDate() - 29);

  const last90 = new Date(today);
  last90.setDate(last90.getDate() - 89);

  return [
    {
      id: "month",
      label: "This month",
      from: formatIsoDate(monthStart),
      to,
    },
    {
      id: "30d",
      label: "Last 30 days",
      from: formatIsoDate(last30),
      to,
    },
    {
      id: "90d",
      label: "Last 90 days",
      to,
      from: formatIsoDate(last90),
    },
  ];
}

function DownloadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12M12 16.5V3"
      />
    </svg>
  );
}

export function PaymentExportAction({
  partnerId,
  partnerName,
  scopeLabel = "all partnership members",
}: {
  partnerId?: string;
  partnerName?: string;
  scopeLabel?: string;
}) {
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [from, setFrom] = useState(defaultExportFromDate);
  const [to, setTo] = useState(defaultExportToDate);
  const [activePreset, setActivePreset] = useState("month");
  const [downloading, setDownloading] = useState(false);
  const presets = buildDatePresets();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !downloading) {
        setOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, downloading]);

  function applyPreset(preset: DatePreset) {
    setFrom(preset.from);
    setTo(preset.to);
    setActivePreset(preset.id);
  }

  async function handleDownload() {
    if (!from || !to) {
      toastError("Choose a start and end date.");
      return;
    }
    if (from > to) {
      toastError("Start date must be on or before end date.");
      return;
    }

    setDownloading(true);
    try {
      await downloadPaymentExport({
        from,
        to,
        partnerId,
        partnerName,
      });
      success(
        partnerName
          ? `Downloaded ${partnerName}'s payment history.`
          : "Downloaded church-wide payment history."
      );
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not download payment history.";
      toastError(message);
    } finally {
      setDownloading(false);
    }
  }

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 sm:p-6">
            <button
              type="button"
              aria-label="Close export dialog"
              className="modal-backdrop-enter absolute inset-0 bg-[#1a1825]/40 backdrop-blur-md"
              onClick={() => {
                if (!downloading) setOpen(false);
              }}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-title"
              aria-describedby="export-description"
              className="modal-enter relative w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-white/80 bg-[rgba(255,255,255,0.94)] shadow-[0_28px_80px_rgba(40,30,80,0.32)] backdrop-blur-2xl"
            >
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet-500/10 to-transparent" />

              <div className="relative px-6 pb-6 pt-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <DownloadIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h2
                      id="export-title"
                      className="text-lg font-semibold tracking-tight text-text-primary"
                    >
                      Export payment history
                    </h2>
                    <p
                      id="export-description"
                      className="mt-1 text-sm leading-relaxed text-text-secondary"
                    >
                      Download a CSV for{" "}
                      <span className="font-medium text-text-primary">
                        {scopeLabel}
                      </span>{" "}
                      to share with pastoral leadership or keep for finance records.
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Quick range
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          activePreset === preset.id
                            ? "bg-primary text-white shadow-sm"
                            : "bg-white/60 text-text-secondary ring-1 ring-white/70 hover:bg-white/80"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="export-from"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted"
                    >
                      From
                    </label>
                    <input
                      id="export-from"
                      type="date"
                      value={from}
                      onChange={(event) => {
                        setFrom(event.target.value);
                        setActivePreset("");
                      }}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="export-to"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted"
                    >
                      To
                    </label>
                    <input
                      id="export-to"
                      type="date"
                      value={to}
                      onChange={(event) => {
                        setTo(event.target.value);
                        setActivePreset("");
                      }}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={downloading}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={downloading}
                    onClick={handleDownload}
                  >
                    <DownloadIcon />
                    {downloading ? "Preparing CSV…" : "Download CSV"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="btn-secondary text-xs sm:text-sm"
        onClick={() => setOpen(true)}
      >
        <DownloadIcon />
        Export CSV
      </button>
      {modal}
    </>
  );
}

/** @deprecated Use PaymentExportAction in section headers instead. */
export function PaymentExportBar(props: React.ComponentProps<typeof PaymentExportAction>) {
  return <PaymentExportAction {...props} />;
}
