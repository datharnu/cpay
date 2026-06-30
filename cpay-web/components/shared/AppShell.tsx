"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveFinanceToasts } from "@/hooks/useLiveFinanceToasts";

const navItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    name: "Add partner",
    href: "/partners/new",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
      </svg>
    ),
  },
];

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen app-bg p-3 sm:p-4 lg:p-5">
      <LiveFinanceToasts />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-[#b8a8d8]/50 blur-[100px]" />
        <div className="absolute -right-20 top-1/4 h-[32rem] w-[32rem] rounded-full bg-[#a8d4cc]/45 blur-[110px]" />
        <div className="absolute bottom-[-4rem] left-1/4 h-80 w-80 rounded-full bg-[#d4b8c8]/45 blur-[90px]" />
        <div className="absolute right-1/3 top-2/3 h-64 w-64 rounded-full bg-[#c8c0e0]/40 blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-shell min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden glass-shell sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-2.5rem)]">
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-sidebar shrink-0 flex-col border-r border-white/35 lg:flex">
            <div className="border-b border-white/35 px-5 py-5">
              <Link href="/" className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-card">
                  CP
                </span>
                <div>
                  <p className="text-base font-bold text-text-primary">CPay</p>
                  <p className="text-xs text-text-secondary">Partnership finance</p>
                </div>
              </Link>
            </div>

            <nav className="flex flex-1 flex-col gap-1 p-4">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? "nav-active-pill text-text-primary"
                        : "text-text-secondary hover:bg-white/30 hover:text-text-primary"
                    }`}
                  >
                    <span className={isActive ? "text-primary" : "text-text-muted"}>
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/35 p-4">
              <div className="liquid-glass liquid-glass-card  p-3">
                <p className="text-xs font-medium text-text-secondary">Powered by</p>
                <p className="mt-0.5 text-sm font-semibold text-text-primary">Nomba sandbox</p>
                <p className="mt-1 text-xs text-text-muted">Live webhook reconciliation</p>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-10 border-b border-white/35 liquid-glass liquid-glass-subtle lg:hidden">
              <div className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6">
                <Link href="/" className="btn-ghost">
                  Home
                </Link>
                <Link href="/partners/new" className="btn-primary">
                  Add
                </Link>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto max-w-5xl space-y-5">
                {title ? (
                  <h1 className="text-h1">{title}</h1>
                ) : null}
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-800",
    partial: "bg-amber-500/15 text-amber-800",
    missed: "bg-red-500/15 text-red-800",
    pending: "bg-white/50 text-text-secondary",
    exact: "bg-emerald-500/15 text-emerald-800",
    under: "bg-amber-500/15 text-amber-800",
    over: "bg-violet-500/15 text-violet-800",
    catch_up: "bg-violet-500/15 text-violet-800",
    pending_choice: "bg-primary-muted text-primary",
    refund_pending: "bg-amber-500/15 text-amber-900",
    credited: "bg-emerald-500/15 text-emerald-800",
    refunded: "bg-white/50 text-text-secondary",
    underpayment: "bg-amber-500/15 text-amber-800",
    overpayment_pending: "bg-primary-muted text-primary",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize backdrop-blur-sm ${styles[status] ?? styles.pending}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}
