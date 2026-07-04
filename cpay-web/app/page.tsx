import Link from "next/link";
import { LiveBadge } from "@/components/shared/ui";

const NOMBA_FEATURES = [
  {
    title: "Virtual Account API",
    detail: "Dedicated NUBAN per partnership member",
  },
  {
    title: "Webhooks",
    detail: "Inbound transfers reconcile automatically",
  },
  {
    title: "Transfers API",
    detail: "Overpayment refunds with bank lookup",
  },
];

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden app-bg p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-[#b8a8d8]/50 blur-[100px]" />
        <div className="absolute -right-20 top-1/4 h-[32rem] w-[32rem] rounded-full bg-[#a8d4cc]/45 blur-[110px]" />
        <div className="absolute bottom-[-4rem] left-1/4 h-80 w-80 rounded-full bg-[#d4b8c8]/45 blur-[90px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="glass-shell overflow-hidden rounded-[1.75rem]">
          <div className="border-b border-white/35 px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-card">
                CP
              </span>
              <div>
                <p className="text-lg font-bold text-text-primary">CPay</p>
                <p className="text-sm text-text-secondary">Church partnership finance</p>
              </div>
              <div className="ml-auto">
                <LiveBadge label="Nomba Hackathon" />
              </div>
            </div>

            <p className="mt-6 inline-flex rounded-full bg-primary-subtle px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Virtual Accounts as Infrastructure
            </p>

            <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl">
              Partnership collections, reconciled automatically
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-text-secondary sm:text-base">
              Hundreds of church partners paid into{" "}
              <span className="font-medium text-text-primary">one shared account</span> — finance
              could not tell who sent each transfer or who was behind on their commitment.
            </p>

            <p className="mt-3 text-sm leading-relaxed text-text-primary sm:text-base">
              Each member gets a{" "}
              <span className="font-semibold">dedicated Nomba account number</span>. When they pay
              from any Nigerian bank, Nomba webhooks reconcile the transfer to the right person
              automatically.
            </p>
          </div>

          <div className="space-y-3 px-6 py-6 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Built with Nomba
            </p>
            <ul className="grid gap-3 sm:grid-cols-3">
              {NOMBA_FEATURES.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl border border-white/60 bg-white/35 px-4 py-3.5"
                >
                  <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/35 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm text-text-secondary">
              Live demo — real Nomba virtual accounts and webhook reconciliation.
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
