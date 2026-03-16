import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOpenEyeConnection } from "./useOpenEyeConnection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { InferenceHistoryRow, ApiKeyRow, DeviceRow } from "@/types/openeye";

export function useHealth() {
  const { client, serverUrl } = useOpenEyeConnection();
  const isDefaultLocalhost = serverUrl === "http://localhost:8000" && typeof window !== "undefined" && window.location.hostname !== "localhost";
  return useQuery({
    queryKey: ["openeye", "health", serverUrl],
    queryFn: () => client.health(),
    refetchInterval: 5000,
    retry: false,
    enabled: !isDefaultLocalhost,
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
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await supabase
        .from("inference_history" as any)
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: (data || []) as unknown as InferenceHistoryRow[], count: count || 0 };
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
      const { error } = await supabase
        .from("inference_history" as any)
        .insert({ ...row, user_id: user.id });
      if (error) throw error;
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
      const { data, error } = await supabase
        .from("api_keys" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ApiKeyRow[];
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
      const { data, error } = await supabase
        .from("devices" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DeviceRow[];
    },
    enabled: !!user,
  });
}
