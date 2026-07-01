"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/shared/Toast";
import { NotificationActivityProvider } from "@/hooks/useNotificationActivity";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <NotificationActivityProvider>{children}</NotificationActivityProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
