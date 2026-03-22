/**
 * React Query hooks for MLOps API.
 * Uses the MLOpsClient abstraction via useOpenEyeConnection,
 * consistent with useGovernanceQueries and other query hooks.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { MLOpsClient } from "@/lib/mlops-client";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
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

function useMLOpsClient(): MLOpsClient | null {
  const { serverUrl, isConnected } = useOpenEyeConnection();
  return useMemo(
    () => (isConnected ? new MLOpsClient(serverUrl) : null),
    [serverUrl, isConnected],
  );
}

export function useModels() {
  const client = useMLOpsClient();
  return useQuery<ModelRegistryEntry[]>({
    queryKey: ["mlops", "models"],
    queryFn: () => client!.listModels(),
    enabled: !!client,
    refetchInterval: 10_000,
  });
}

export function usePromotions() {
  const client = useMLOpsClient();
  return useQuery<PromotionRecord[]>({
    queryKey: ["mlops", "promotions"],
    queryFn: () => client!.listPromotions(),
    enabled: !!client,
  });
}

export function useABTests() {
  const client = useMLOpsClient();
  return useQuery<ABTestResult[]>({
    queryKey: ["mlops", "ab-tests"],
    queryFn: () => client!.listABTests(),
    enabled: !!client,
    refetchInterval: 5_000,
  });
}

export function useRetrainingRuns() {
  const client = useMLOpsClient();
  return useQuery<RetrainingRun[]>({
    queryKey: ["mlops", "retraining-runs"],
    queryFn: () => client!.listRetrainingRuns(),
    enabled: !!client,
  });
}

export function useBatchJobs() {
  const client = useMLOpsClient();
  return useQuery<BatchInferenceJob[]>({
    queryKey: ["mlops", "batch-jobs"],
    queryFn: () => client!.listBatchJobs(),
    enabled: !!client,
  });
}

export function useShadowDeployments() {
  const client = useMLOpsClient();
  return useQuery<ShadowDeployment[]>({
    queryKey: ["mlops", "shadow-deployments"],
    queryFn: () => client!.listShadowDeployments(),
    enabled: !!client,
    refetchInterval: 5_000,
  });
}

export function useAnnotations() {
  const client = useMLOpsClient();
  return useQuery<InferenceFailureAnnotation[]>({
    queryKey: ["mlops", "annotations"],
    queryFn: () => client!.listAnnotations(),
    enabled: !!client,
  });
}

export function useValidationRuns() {
  const client = useMLOpsClient();
  return useQuery<ValidationTestRun[]>({
    queryKey: ["mlops", "validation-runs"],
    queryFn: () => client!.listValidationRuns(),
    enabled: !!client,
  });
}

export function useExports() {
  const client = useMLOpsClient();
  return useQuery<ExportResult[]>({
    queryKey: ["mlops", "exports"],
    queryFn: () => client!.listExports(),
    enabled: !!client,
  });
}

export function useLineage() {
  const client = useMLOpsClient();
  return useQuery<ModelLineage[]>({
    queryKey: ["mlops", "lineage"],
    queryFn: () => client!.listLineage(),
    enabled: !!client,
  });
}

export function useFeedbackBatches() {
  const client = useMLOpsClient();
  return useQuery<FeedbackBatch[]>({
    queryKey: ["mlops", "feedback-batches"],
    queryFn: () => client!.listFeedbackBatches(),
    enabled: !!client,
  });
}
