"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/shared/Toast";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/useCpay";
import { useNotificationActivity } from "@/hooks/useNotificationActivity";
import type { AppNotification } from "@/types";

type FeedItem =
  | { source: "server"; item: AppNotification }
  | {
      source: "activity";
      item: {
        id: string;
        title: string;
        message: string;
        tone: "error" | "warning" | "success" | "info";
        partnerId?: string;
        partnerName?: string;
        href?: string;
        createdAt: number;
        read: boolean;
      };
    };

function formatRelativeTime(iso: string | number) {
  const diff = Date.now() - (typeof iso === "number" ? iso : new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function toneForType(type: string): "info" | "warning" | "success" {
  if (type === "underpayment") return "warning";
  if (type === "overpayment_resolved") return "success";
  return "info";
}

function NotificationIcon({ type, tone }: { type?: string; tone?: string }) {
  const base = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl";
  const resolved = tone === "success" || type === "overpayment_resolved";
  const warning = tone === "warning" || type === "underpayment";

  const cls = resolved
    ? `${base} bg-emerald-500/15 text-emerald-700`
    : warning
      ? `${base} bg-amber-500/15 text-amber-800`
      : `${base} bg-primary-muted text-primary`;

  if (resolved) {
    return (
      <span className={cls}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </span>
    );
  }

  if (warning) {
    return (
      <span className={cls}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </span>
    );
  }

  return (
    <span className={cls}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    </span>
  );
}

function FeedRow({
  unread,
  icon,
  title,
  message,
  meta,
  animationIndex,
  onClick,
}: {
  unread: boolean;
  icon: React.ReactNode;
  title: string;
  message: string;
  meta: string;
  animationIndex: number;
  onClick: () => void;
}) {
  return (
    <li
      className="notification-item-enter"
      style={{ animationDelay: `${80 + animationIndex * 70}ms` }}
    >
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full gap-3 px-4 py-3.5 text-left transition ${
          unread
            ? "bg-primary-subtle/60 hover:bg-primary-subtle/80"
            : "bg-white/40 hover:bg-white/55"
        }`}
      >
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm leading-snug ${unread ? "font-semibold text-text-primary" : "font-medium text-text-primary"}`}>
              {title}
            </p>
            {unread ? (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary ring-2 ring-primary/20" />
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{message}</p>
          <p className="mt-1.5 text-[11px] text-text-muted">{meta}</p>
        </div>
        <svg
          className="mt-2 h-4 w-4 shrink-0 text-text-muted opacity-0 transition group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </li>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; right: number; width: number }>({
    top: 0,
    right: 16,
    width: 360,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const activity = useNotificationActivity();

  const serverItems = data?.items ?? [];
  const serverUnread = data?.unreadCount ?? 0;
  const totalUnread = serverUnread + activity.unreadCount;

  useEffect(() => setMounted(true), []);

  const updatePanelPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 24);
    const right = Math.max(12, window.innerWidth - rect.right);
    const top = Math.min(rect.bottom + 10, window.innerHeight - 24);

    setPanelStyle({ top, right, width });
  }, []);

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      if (next) {
        requestAnimationFrame(updatePanelPosition);
      }
      return next;
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function reshowToast(message: string, tone: "error" | "warning" | "success" | "info") {
    toast(message, { tone, duration: 7000 });
  }

  async function handleServerClick(item: AppNotification) {
    if (!item.read) {
      await markRead.mutateAsync(item.id);
    }
    reshowToast(`${item.title}: ${item.message}`, toneForType(item.type));
    setOpen(false);
    router.push(`/partners/${item.partnerId}`);
  }

  function handleActivityClick(item: (typeof activity.items)[number]) {
    activity.markRead(item.id);
    reshowToast(item.message, item.tone);
    setOpen(false);
    if (item.href) {
      router.push(item.href);
    } else if (item.partnerId) {
      router.push(`/partners/${item.partnerId}`);
    }
  }

  async function handleMarkAllRead() {
    activity.markAllRead();
    if (serverUnread > 0) {
      await markAllRead.mutateAsync();
    }
  }

  const feed: FeedItem[] = [
    ...serverItems.map((item) => ({ source: "server" as const, item })),
    ...activity.items.map((item) => ({ source: "activity" as const, item })),
  ].sort((a, b) => {
    const aTime =
      a.source === "server"
        ? new Date(a.item.createdAt).getTime()
        : a.item.createdAt;
    const bTime =
      b.source === "server"
        ? new Date(b.item.createdAt).getTime()
        : b.item.createdAt;
    return bTime - aTime;
  });

  const unreadFeed = feed.filter((row) =>
    row.source === "server" ? !row.item.read : !row.item.read
  );
  const readFeed = feed.filter((row) =>
    row.source === "server" ? row.item.read : row.item.read
  );

  const overlay = open && mounted ? (
    <>
      <button
        type="button"
        aria-label="Close notifications"
        className="notification-backdrop-enter fixed inset-0 z-[190] bg-[#1a1825]/25 backdrop-blur-[3px]"
        onClick={() => setOpen(false)}
      />

      <div
        className="notification-panel-enter fixed z-[200]"
        style={{
          top: panelStyle.top,
          right: panelStyle.right,
          width: panelStyle.width,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="flex max-h-[min(78vh,32rem)] flex-col overflow-hidden rounded-2xl border border-white/80 bg-[rgba(255,255,255,0.94)] shadow-[0_24px_60px_rgba(40,30,80,0.28)] backdrop-blur-xl"
        >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/60 bg-white/50 px-4 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-text-primary">Notifications</p>
              {totalUnread > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  {totalUnread} new
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-text-muted">Tap an alert to re-show it and open the member</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {totalUnread > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="rounded-lg px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary-muted"
              >
                Mark all read
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-text-muted transition hover:bg-white/40 hover:text-text-primary"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[min(58vh,24rem)] overflow-y-auto overscroll-contain bg-white/30">
          {feed.length === 0 ? (
            <div className="notification-item-enter flex flex-col items-center px-6 py-12 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/35 text-text-muted">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0" />
                </svg>
              </span>
              <p className="text-sm font-semibold text-text-primary">All caught up</p>
              <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-text-muted">
                Payment alerts and member updates will show up here in real time.
              </p>
            </div>
          ) : (
            <>
              {unreadFeed.length > 0 ? (
                <div>
                  <p className="sticky top-0 z-[1] border-b border-white/50 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted backdrop-blur-sm">
                    New
                  </p>
                  <ul className="divide-y divide-white/50">
                    {unreadFeed.map((row, index) =>
                      row.source === "server" ? (
                        <FeedRow
                          key={`server-${row.item.id}`}
                          animationIndex={index}
                          unread
                          icon={<NotificationIcon type={row.item.type} />}
                          title={row.item.title}
                          message={row.item.message}
                          meta={`${row.item.partnerName} · ${formatRelativeTime(row.item.createdAt)}`}
                          onClick={() => handleServerClick(row.item)}
                        />
                      ) : (
                        <FeedRow
                          key={`activity-${row.item.id}`}
                          animationIndex={index}
                          unread
                          icon={<NotificationIcon tone={row.item.tone} />}
                          title={row.item.title}
                          message={row.item.message}
                          meta={`Live · ${formatRelativeTime(row.item.createdAt)}`}
                          onClick={() => handleActivityClick(row.item)}
                        />
                      )
                    )}
                  </ul>
                </div>
              ) : null}

              {readFeed.length > 0 ? (
                <div>
                  {unreadFeed.length > 0 ? (
                    <p className="sticky top-0 z-[1] border-b border-white/50 bg-white/75 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted backdrop-blur-sm">
                      Earlier
                    </p>
                  ) : null}
                  <ul className="divide-y divide-white/40">
                    {readFeed.map((row, index) =>
                      row.source === "server" ? (
                        <FeedRow
                          key={`server-${row.item.id}`}
                          animationIndex={unreadFeed.length + index}
                          unread={false}
                          icon={<NotificationIcon type={row.item.type} />}
                          title={row.item.title}
                          message={row.item.message}
                          meta={`${row.item.partnerName} · ${formatRelativeTime(row.item.createdAt)}`}
                          onClick={() => handleServerClick(row.item)}
                        />
                      ) : (
                        <FeedRow
                          key={`activity-${row.item.id}`}
                          animationIndex={unreadFeed.length + index}
                          unread={false}
                          icon={<NotificationIcon tone={row.item.tone} />}
                          title={row.item.title}
                          message={row.item.message}
                          meta={`Live · ${formatRelativeTime(row.item.createdAt)}`}
                          onClick={() => handleActivityClick(row.item)}
                        />
                      )
                    )}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-white/60 bg-white/50 px-4 py-2.5">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open dashboard
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${
          open
            ? "border-primary/40 bg-primary-muted text-primary shadow-sm"
            : "border-white/50 bg-white/30 text-text-secondary hover:bg-white/50 hover:text-text-primary"
        }`}
        aria-label={`Notifications${totalUnread ? `, ${totalUnread} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {totalUnread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm ring-2 ring-white/80">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        ) : null}
      </button>

      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
