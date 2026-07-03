import api from "@/api/axios";
import type {
  DashboardSummary,
  NotificationsFeed,
  OverpaymentCase,
  PartnerDetail,
  PartnerListItem,
  PaymentListItem,
  ReconciliationResult,
  ResolveOverpaymentInput,
  NombaBank,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePartnerInput } from "@/app/utils/SchemaData";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const { data } = await api.get<{ data: DashboardSummary }>("/api/dashboard/summary");
      return data.data;
    },
    refetchInterval: 5_000,
  });
}

export function usePartners() {
  return useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data } = await api.get<{ data: PartnerListItem[] }>("/api/partners");
      return data.data;
    },
    refetchInterval: 5_000,
  });
}

export function useAllPayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data } = await api.get<{ data: PaymentListItem[] }>("/api/payments");
      return data.data;
    },
    refetchInterval: 5_000,
  });
}

export function usePartner(id: string) {
  return useQuery({
    queryKey: ["partners", id],
    queryFn: async () => {
      const { data } = await api.get<{ data: PartnerDetail }>(`/api/partners/${id}`);
      return data.data;
    },
    enabled: !!id,
    refetchInterval: 5_000,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePartnerInput) => {
      const payload = {
        ...input,
        email: input.email || undefined,
      };
      const { data } = await api.post("/api/partners", payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeactivatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{
        data: {
          id: string;
          status: string;
          virtualAccountNumber?: string | null;
          vaExpired: boolean;
          dismissedOverpayments?: number;
          message: string;
        };
      }>(`/api/partners/${id}/deactivate`);
      return data.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["partners", id] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["overpayments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useReconcileNomba() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: ReconciliationResult }>(
        "/api/reconciliation/sync"
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });
}

export function useImportMissingNomba() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        data: { imported: number; skipped: number };
      }>("/api/reconciliation/import-missing");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });
}

export function useReprocessUnmatched() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        data: { fixed: number; skipped: number; purged: number; total: number };
      }>("/api/reconciliation/reprocess-unmatched");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
  });
}

export function usePartnerNombaTransactions(partnerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["nomba-transactions", partnerId],
    queryFn: async () => {
      const { data } = await api.get<{
        data: { transactions: Array<Record<string, unknown>> };
      }>(`/api/reconciliation/partners/${partnerId}/nomba-transactions`);
      return data.data.transactions;
    },
    enabled: enabled && !!partnerId,
  });
}

export function usePendingOverpayments() {
  return useQuery({
    queryKey: ["overpayments", "pending"],
    queryFn: async () => {
      const { data } = await api.get<{ data: OverpaymentCase[] }>("/api/overpayments");
      return data.data;
    },
  });
}

export function useNombaBanks(enabled = true) {
  return useQuery({
    queryKey: ["nomba", "banks"],
    queryFn: async () => {
      const { data } = await api.get<{ data: NombaBank[] }>("/api/reconciliation/banks");
      return data.data;
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

export function useResolveOverpayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: ResolveOverpaymentInput;
    }) => {
      const { data } = await api.post(`/api/overpayments/${id}/resolve`, input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overpayments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useCheckRefundStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (overpaymentId: string) => {
      const { data } = await api.post(`/api/overpayments/${overpaymentId}/check-refund`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overpayments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get<{ data: NotificationsFeed }>("/api/notifications");
      return data.data;
    },
    refetchInterval: 5_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/api/notifications/${id}/read`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/api/notifications/read-all");
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
