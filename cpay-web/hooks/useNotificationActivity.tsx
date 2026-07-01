"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ActivityTone = "error" | "warning" | "success" | "info";

export type ActivityItem = {
  id: string;
  title: string;
  message: string;
  tone: ActivityTone;
  partnerId?: string;
  partnerName?: string;
  href?: string;
  createdAt: number;
  read: boolean;
};

type NotificationActivityContextValue = {
  items: ActivityItem[];
  unreadCount: number;
  push: (item: Omit<ActivityItem, "read" | "createdAt">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  getItem: (id: string) => ActivityItem | undefined;
};

const NotificationActivityContext =
  createContext<NotificationActivityContextValue | null>(null);

export function NotificationActivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  const push = useCallback(
    (item: Omit<ActivityItem, "read" | "createdAt">) => {
      setItems((current) => {
        if (current.some((row) => row.id === item.id)) return current;
        const next: ActivityItem = {
          ...item,
          read: false,
          createdAt: Date.now(),
        };
        return [next, ...current].slice(0, 40);
      });
    },
    []
  );

  const markRead = useCallback((id: string) => {
    setItems((current) =>
      current.map((row) => (row.id === id ? { ...row, read: true } : row))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setItems((current) => current.map((row) => ({ ...row, read: true })));
  }, []);

  const getItem = useCallback(
    (id: string) => items.find((row) => row.id === id),
    [items]
  );

  const unreadCount = items.filter((row) => !row.read).length;

  const value = useMemo(
    () => ({ items, unreadCount, push, markRead, markAllRead, getItem }),
    [items, unreadCount, push, markRead, markAllRead, getItem]
  );

  return (
    <NotificationActivityContext.Provider value={value}>
      {children}
    </NotificationActivityContext.Provider>
  );
}

export function useNotificationActivity() {
  const context = useContext(NotificationActivityContext);
  if (!context) {
    throw new Error(
      "useNotificationActivity must be used within NotificationActivityProvider"
    );
  }
  return context;
}
