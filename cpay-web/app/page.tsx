import Link from "next/link";
import { LiveBadge } from "@/components/shared/ui";

const NOMBA_FEATURES = [
  { title: "Virtual Account API", detail: "Unique NUBAN per member" },
  { title: "Webhooks", detail: "Payments reconcile automatically" },
  { title: "Transfers API", detail: "Overpayment refunds handled" },
];

const BEFORE_AFTER = [
  { before: "One account, 500 members", after: "Unique account per member" },
  { before: "Manual credit matching", after: "Auto-reconciled instantly" },
  { before: "Missed months unnoticed", after: "Gaps flagged immediately" },
  { before: "No context on who paid", after: "Full dashboard clarity" },
];

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden app-bg p-4 sm:p-6">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-[#b8a8d8]/50 blur-[100px]" />
        <div className="absolute -right-20 top-1/4 h-[32rem] w-[32rem] rounded-full bg-[#a8d4cc]/45 blur-[110px]" />
        <div className="absolute bottom-[-4rem] left-1/4 h-80 w-80 rounded-full bg-[#d4b8c8]/45 blur-[90px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="glass-shell overflow-hidden rounded-[1.75rem]">

          {/* Header */}
          <div className="border-b border-white/35 px-6 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-card">
                CP
              </span>
              <div>
                <p className="text-base font-bold text-text-primary">CPay</p>
                <p className="text-xs text-text-secondary">Church partnership finance</p>
              </div>
              <div className="ml-auto">
                <LiveBadge label="Nomba Hackathon" />
              </div>
            </div>

            <p className="mt-4 inline-flex rounded-full bg-primary-subtle px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Virtual Accounts as Infrastructure
            </p>

            <h1 className="mt-2 text-xl font-bold leading-snug tracking-tight text-text-primary sm:text-2xl">
              Partnership collections, reconciled automatically
            </h1>
          </div>

          {/* Problem + Fix — side by side on sm+ */}
          <div className="border-b border-white/35 grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/25">
            <div className="px-6 py-5 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                The problem
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">
                500 members pay into <span className="font-medium text-text-primary">one shared account</span>. The finance manager gets a wall of credits no names, no context. Missed months and underpayments go unnoticed.
              </p>
            </div>
            <div className="px-6 py-5 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                The fix
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">
                Every member gets a <span className="font-semibold text-text-primary">dedicated Nomba account number</span>. The moment they pay, it is matched automatically — right person, right month, right amount.
              </p>
            </div>
          </div>

          {/* Before / After */}
          <div className="border-b border-white/35 px-6 py-5 sm:px-8">
            <div className="grid grid-cols-2 gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted pb-1">Before</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary pb-1">With CPay</p>
              {BEFORE_AFTER.map((row, i) => (
                <>
                  <div key={`b-${i}`} className="rounded-xl border border-white/40 bg-white/20 px-3 py-2.5">
                    <p className="text-xs leading-relaxed text-text-secondary">{row.before}</p>
                  </div>
                  <div key={`a-${i}`} className="rounded-xl border border-primary/25 bg-primary-subtle px-3 py-2.5">
                    <p className="text-xs leading-relaxed text-text-primary font-medium">{row.after}</p>
                  </div>
                </>
              ))}
            </div>
          </div>

          {/* Built with Nomba */}
          <div className="border-b border-white/35 px-6 py-5 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Built with Nomba
            </p>
            <ul className="grid gap-2 sm:grid-cols-3">
              {NOMBA_FEATURES.map((item) => (
                <li key={item.title} className="rounded-xl border border-white/60 bg-white/35 px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-xs text-text-muted">
              Live demo · real Nomba virtual accounts + webhook reconciliation
            </p>
            <Link href="/dashboard" className="btn-primary shrink-0 px-6 py-3 text-sm font-semibold">
              Open finance dashboard →
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}