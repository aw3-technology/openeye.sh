import { useQuery } from "@tanstack/react-query";
import type {
  ModelRegistryEntry,
  ABTestResult,
  RetrainingRun,
  BatchInferenceJob,
  ValidationTestRun,
  ShadowDeployment,
  InferenceFailureAnnotation,
  PromotionRecord,
  ExportResult,
  ModelLineage,
  FeedbackBatch,
} from "@/types/mlops";

export const stageBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  dev: "outline",
  staging: "secondary",
  production: "default",
  archived: "destructive",
};

async function fetchJson<T>(baseUrl: string, path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    signal: signal ?? AbortSignal.timeout(15_000),
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function useModels(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "models"],
    queryFn: () => fetchJson<ModelRegistryEntry[]>(baseUrl, "/mlops/models"),
    enabled: !!baseUrl,
    refetchInterval: 10_000,
  });
}

export function usePromotions(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "promotions"],
    queryFn: () => fetchJson<PromotionRecord[]>(baseUrl, "/mlops/promotions"),
    enabled: !!baseUrl,
  });
}

export function useABTests(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "ab-tests"],
    queryFn: () => fetchJson<ABTestResult[]>(baseUrl, "/mlops/ab-tests"),
    enabled: !!baseUrl,
    refetchInterval: 5_000,
  });
}

export function useRetrainingRuns(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "retraining-runs"],
    queryFn: () => fetchJson<RetrainingRun[]>(baseUrl, "/mlops/retraining/runs"),
    enabled: !!baseUrl,
  });
}

export function useBatchJobs(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "batch-jobs"],
    queryFn: () => fetchJson<BatchInferenceJob[]>(baseUrl, "/mlops/batch-inference"),
    enabled: !!baseUrl,
  });
}

export function useShadowDeployments(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "shadow-deployments"],
    queryFn: () => fetchJson<ShadowDeployment[]>(baseUrl, "/mlops/shadow-deployments"),
    enabled: !!baseUrl,
    refetchInterval: 5_000,
  });
}

export function useAnnotations(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "annotations"],
    queryFn: () => fetchJson<InferenceFailureAnnotation[]>(baseUrl, "/mlops/annotations"),
    enabled: !!baseUrl,
  });
}

export function useValidationRuns(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "validation-runs"],
    queryFn: () => fetchJson<ValidationTestRun[]>(baseUrl, "/mlops/validation-runs"),
    enabled: !!baseUrl,
  });
}

export function useExports(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "exports"],
    queryFn: () => fetchJson<ExportResult[]>(baseUrl, "/mlops/exports"),
    enabled: !!baseUrl,
  });
}

export function useLineage(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "lineage"],
    queryFn: () => fetchJson<ModelLineage[]>(baseUrl, "/mlops/lineage"),
    enabled: !!baseUrl,
  });
}

export function useFeedbackBatches(baseUrl: string) {
  return useQuery({
    queryKey: ["mlops", "feedback-batches"],
    queryFn: () => fetchJson<FeedbackBatch[]>(baseUrl, "/mlops/feedback-batches"),
    enabled: !!baseUrl,
  });
}
