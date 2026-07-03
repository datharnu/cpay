"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationCenter } from "@/components/shared/NotificationCenter";
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
    name: "Partnership members",
    href: "/partners",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766m12.748 0c-.995.608-2.085.96-3.228 1.066M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    name: "Payment history",
    href: "/payments",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.375M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/partners") {
    return (
      pathname === "/partners" ||
      (pathname.startsWith("/partners/") && !pathname.startsWith("/partners/new"))
    );
  }
  if (href === "/payments") return pathname === "/payments";
  return pathname.startsWith(href);
}

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="relative flex h-screen overflow-hidden app-bg p-3 sm:p-4 lg:p-5">
      <LiveFinanceToasts />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-[#b8a8d8]/50 blur-[100px]" />
        <div className="absolute -right-20 top-1/4 h-[32rem] w-[32rem] rounded-full bg-[#a8d4cc]/45 blur-[110px]" />
        <div className="absolute bottom-[-4rem] left-1/4 h-80 w-80 rounded-full bg-[#d4b8c8]/45 blur-[90px]" />
        <div className="absolute right-1/3 top-2/3 h-64 w-64 rounded-full bg-[#c8c0e0]/40 blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-shell min-h-0 overflow-hidden glass-shell">
        {/* Sidebar — fixed height, never scrolls the page */}
        <aside className="hidden h-full w-sidebar shrink-0 flex-col overflow-hidden border-r border-white/35 lg:flex">
          <div className="shrink-0 border-b border-white/35 px-5 py-5">
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

          <nav className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = isNavActive(pathname, item.href);

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
            </div>
          </nav>

          <div className="shrink-0 border-t border-white/35 p-4">
            <div className="liquid-glass liquid-glass-card p-3">
              <p className="text-xs font-medium text-text-secondary">Powered by</p>
              <p className="mt-0.5 text-sm font-semibold text-text-primary">Nomba sandbox</p>
              <p className="mt-1 text-xs text-text-muted">Live webhook reconciliation</p>
            </div>
          </div>
        </aside>

        {/* Main column — header fixed, content scrolls internally */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-white/35 liquid-glass liquid-glass-subtle">
            <div className="flex h-[4.25rem] items-center justify-between gap-4 px-4 sm:px-6">
              <h1 className="min-w-0 truncate text-xl font-bold leading-tight text-text-primary sm:text-[26px]">
                {title ?? "CPay"}
              </h1>

              <div className="flex shrink-0 items-center gap-2">
                <NotificationCenter />
                <div className="flex items-center gap-2 lg:hidden">
                  <Link href="/" className="btn-ghost">
                    Home
                  </Link>
                  <Link href="/partners" className="btn-ghost">
                    Members
                  </Link>
                  <Link href="/payments" className="btn-ghost">
                    Payments
                  </Link>
                  <Link href="/partners/new" className="btn-primary">
                    Add
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-5xl space-y-5">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
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
    active: "bg-emerald-500/15 text-emerald-800",
    inactive: "bg-white/50 text-text-secondary",
  };

  const resolved = status?.trim() || "pending";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize backdrop-blur-sm ${styles[resolved] ?? styles.pending}`}
    >
      {resolved.replace(/_/g, " ")}
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
