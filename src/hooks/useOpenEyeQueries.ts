import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOpenEyeConnection } from "./useOpenEyeConnection";
import { api } from "@/lib/api";
import { useAuth } from "./useAuth";
import type { InferenceHistoryRow, ApiKeyRow, DeviceRow } from "@/types/openeye";

export function useHealth() {
  const { client, serverUrl } = useOpenEyeConnection();
  return useQuery({
    queryKey: ["openeye", "health", serverUrl],
    queryFn: () => client.health(),
    refetchInterval: 5000,
    retry: false,
    enabled: serverUrl.trim() !== "",
  });
}

export function usePredict() {
  const { client } = useOpenEyeConnection();
  return useMutation({
    mutationFn: ({ file, prompt }: { file: File; prompt?: string }) =>
      client.predict(file, prompt),
  });
}

export function useInferenceHistory(page = 0, pageSize = 20) {
  const { user, isDemo } = useAuth();
  return useQuery({
    queryKey: ["openeye", "inference_history", user?.id, page, pageSize],
    queryFn: async () => {
      if (!user || isDemo) return { data: [] as InferenceHistoryRow[], count: 0 };
      const { data, count } = await api.list<InferenceHistoryRow>("inference_history", {
        limit: pageSize,
        offset: page * pageSize,
        count: 1,
      });
      return { data, count: count || 0 };
    },
    enabled: !!user,
  });
}

export function useSaveInference() {
  const { user, isDemo } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Omit<InferenceHistoryRow, "id" | "user_id" | "created_at">) => {
      if (!user || isDemo) return;
      await api.create("inference_history", row);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["openeye", "inference_history"] });
    },
  });
}

export function useApiKeys() {
  const { user, isDemo } = useAuth();
  return useQuery({
    queryKey: ["openeye", "api_keys", user?.id],
    queryFn: async () => {
      if (!user || isDemo) return [];
      const { data } = await api.list<ApiKeyRow>("api_keys");
      return data;
    },
    enabled: !!user,
  });
}

export function useDevices() {
  const { user, isDemo } = useAuth();
  return useQuery({
    queryKey: ["openeye", "devices", user?.id],
    queryFn: async () => {
      if (!user || isDemo) return [];
      const { data } = await api.list<DeviceRow>("devices");
      return data;
    },
    enabled: !!user,
  });
}
