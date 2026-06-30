"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastTone = "error" | "warning" | "success" | "info";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastOptions = {
  tone?: ToastTone;
  duration?: number;
};

type ToastContextValue = {
  toast: (message: string, options?: ToastOptions) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<
  ToastTone,
  { border: string; icon: string; iconBg: string }
> = {
  error: {
    border: "border-l-red-500",
    icon: "text-red-700",
    iconBg: "bg-red-500/15",
  },
  warning: {
    border: "border-l-amber-500",
    icon: "text-amber-800",
    iconBg: "bg-amber-500/15",
  },
  success: {
    border: "border-l-emerald-500",
    icon: "text-emerald-700",
    iconBg: "bg-emerald-500/15",
  },
  info: {
    border: "border-l-primary",
    icon: "text-primary",
    iconBg: "bg-primary-muted",
  },
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }

  if (tone === "info") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const styles = toneStyles[item.tone];

  return (
    <div
      role="alert"
      className={`toast-enter pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border-l-[3px] px-4 py-3.5 shadow-card liquid-glass liquid-glass-card ${styles.border}`}
      style={{ "--liquid-blur": "36px" } as React.CSSProperties}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${styles.iconBg} ${styles.icon}`}
      >
        <ToastIcon tone={item.tone} />
      </span>
      <p className="flex-1 pt-1 text-sm leading-relaxed text-text-primary">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-white/40 hover:text-text-primary"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = crypto.randomUUID();
      const tone = options?.tone ?? "info";
      const duration = options?.duration ?? 6000;

      setToasts((current) => [...current, { id, message, tone }]);

      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return {
    toast: context.toast,
    dismiss: context.dismiss,
    error: (message: string, duration?: number) =>
      context.toast(message, { tone: "error", duration }),
    warning: (message: string, duration?: number) =>
      context.toast(message, { tone: "warning", duration }),
    success: (message: string, duration?: number) =>
      context.toast(message, { tone: "success", duration }),
    info: (message: string, duration?: number) =>
      context.toast(message, { tone: "info", duration }),
  };
}
