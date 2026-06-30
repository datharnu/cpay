import Image from "next/image";
import Link from "next/link";

export function StatCard({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  icon?: React.ReactNode;
}) {
  const valueTones = {
    default: "text-text-primary",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
    info: "text-primary",
  };

  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        {icon ? (
          <span className="liquid-glass liquid-glass-orb flex h-9 w-9 shrink-0 items-center justify-center text-text-secondary">
            {icon}
          </span>
        ) : null}
      </div>
      <p className={`text-2xl font-bold tracking-tight ${valueTones[tone]}`}>{value}</p>
    </div>
  );
}

export function AlertSection({
  title,
  description,
  tone,
  children,
}: {
  title: string;
  description?: string;
  tone: "info" | "warning" | "danger" | "success";
  children?: React.ReactNode;
}) {
  const accentBorder = {
    info: "border-l-primary",
    warning: "border-l-amber-500",
    danger: "border-l-red-500",
    success: "border-l-emerald-500",
  };

  return (
    <section className={`card overflow-hidden border-l-[3px] ${accentBorder[tone]}`}>
      <div className="border-b border-white/40 px-5 py-4">
        <h2 className="section-title">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {children ? <div className="p-4">{children}</div> : null}
    </section>
  );
}

export function AlertListItem({
  href,
  actionLabel,
  children,
  actionTone = "info",
}: {
  href?: string;
  actionLabel?: string;
  children: React.ReactNode;
  actionTone?: "info" | "warning" | "danger";
}) {
  const actionColors = {
    info: "text-primary hover:text-primary-hover",
    warning: "text-amber-800 hover:text-amber-950",
    danger: "text-red-700 hover:text-red-900",
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 liquid-glass liquid-glass-card rounded-2xl px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">{children}</div>
      {href && actionLabel ? (
        <Link href={href} className={`shrink-0 font-medium ${actionColors[actionTone]}`}>
          {actionLabel} →
        </Link>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/50 glass-subtle px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center liquid-glass liquid-glass-orb text-primary">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>
      <p className="font-semibold text-text-primary">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn-primary mt-6">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function PageSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/35 px-5 py-4">
        <div>
          <h2 className="section-title">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const PROBLEM_BEFORE = [
  "500+ partners pay into one church account",
  "Finance can't tell who sent each transfer",
  "Missed months and catch-up payments get lost in spreadsheets",
];

const PROBLEM_AFTER = [
  "Each member gets a dedicated Nomba virtual account",
  "Webhooks identify the payer and update the ledger instantly",
  "Paid, partial, arrears, and overpayments tracked per person",
];

export function ProblemHero({
  status,
  meta,
}: {
  status?: React.ReactNode;
  meta?: string;
}) {
  return (
    <section className="problem-hero">
      <div className="relative overflow-hidden">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-start lg:gap-8 lg:py-7">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
              Church partnership program
            </p>
            <h2 className="mt-2 max-w-xl text-2xl font-bold leading-tight text-text-primary sm:text-[1.75rem]">
              500 partners. One bank account.{" "}
              <span className="text-primary">Nobody knew who paid.</span>
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-secondary">
              CPay gives every partnership member their own account number. When they
              transfer from any Nigerian bank, Nomba webhooks reconcile the payment
              against their monthly commitment — automatically.
            </p>
            {status ? <div className="mt-4">{status}</div> : null}
          </div>

          <div className="relative mx-auto h-44 w-40 shrink-0 sm:h-48 sm:w-44 lg:mx-0 lg:h-52 lg:w-48">
            <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/50 shadow-card">
              <Image
                src="/hero-partner.png"
                alt="Church finance manager reviewing partnership payments"
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 176px, 192px"
                priority
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-white/35 px-4 py-4 sm:grid-cols-2 sm:px-6 sm:py-5">
          <ProblemCompareCard
            label="Before CPay"
            tone="before"
            items={PROBLEM_BEFORE}
          />
          <ProblemCompareCard label="With CPay" tone="after" items={PROBLEM_AFTER} />
        </div>

        <div className="hero-banner-footer border-t border-white/35">
          <FooterMeta
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
            label={meta ?? "Awaiting first sync"}
          />
          <FooterMeta
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m6 0h3m-16.5 0a2.25 2.25 0 0 1-2.25-2.25V6.75A2.25 2.25 0 0 1 6 4.5h12a2.25 2.25 0 0 1 2.25 2.25v5.25A2.25 2.25 0 0 1 18 13.5H6Z" />
              </svg>
            }
            label="Nomba Virtual Accounts track"
          />
          <FooterMeta
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            }
            label="Live webhook reconciliation"
          />
        </div>
      </div>
    </section>
  );
}

function ProblemCompareCard({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "before" | "after";
  items: string[];
}) {
  const isBefore = tone === "before";

  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        isBefore
          ? "border-red-200/80 bg-red-500/5"
          : "border-emerald-200/80 bg-emerald-500/5"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            isBefore ? "bg-red-500/15 text-red-700" : "bg-emerald-500/15 text-emerald-700"
          }`}
        >
          {isBefore ? "✕" : "✓"}
        </span>
        <p
          className={`text-sm font-semibold ${
            isBefore ? "text-red-900" : "text-emerald-900"
          }`}
        >
          {label}
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-sm leading-snug text-text-secondary"
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                isBefore ? "bg-red-400" : "bg-emerald-500"
              }`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeroBanner({
  badge,
  title,
  description,
  status,
  meta,
  imageSrc = "/hero-partner.png",
  imageAlt = "Partnership finance lead",
}: {
  badge: string;
  title: string;
  description: string;
  status?: React.ReactNode;
  meta?: string;
  imageSrc?: string;
  imageAlt?: string;
}) {
  return (
    <div className="dashboard-banner">
      <div className="relative flex min-h-[200px] flex-col sm:flex-row sm:items-stretch">
        <div className="flex flex-1 flex-col justify-center px-6 py-6 sm:pr-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
            Your partnership hub
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary">
            {badge}
          </p>
          <h2 className="mt-2 max-w-md text-xl font-bold leading-tight text-text-primary sm:text-[1.65rem]">
            {title}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
          {status ? <div className="mt-3">{status}</div> : null}
        </div>

        <div className="relative mx-auto h-48 w-44 shrink-0 sm:mx-0  sm:h-auto sm:w-48 md:w-96">
          <div className="relative h-full min-h-[12rem] w-full overflow-hidden rounded-t-[0.9rem] sm:absolute sm:inset-x-0 sm:bottom-0 sm:min-h-[13.5rem]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              className="object-cover object-top"
              sizes="(max-width: 640px) 176px, 208px"
              priority
            />
          </div>
        </div>
      </div>

      <div className="hero-banner-footer">
        <FooterMeta
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
          label={meta ?? "Awaiting first sync"}
        />
        <FooterMeta
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.375M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
          }
          label="Nomba virtual accounts"
        />
        <FooterMeta
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          }
          label="Sandbox · max ₦150"
        />
      </div>
    </div>
  );
}

function FooterMeta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-text-secondary">
      <span className="text-text-muted">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export function LiveBadge({ label = "Auto-refreshing" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full liquid-glass liquid-glass-pill px-3 py-1 text-xs font-medium text-primary">
      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
      {label}
    </span>
  );
}
