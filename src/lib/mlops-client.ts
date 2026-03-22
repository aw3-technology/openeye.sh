/**
 * MLOps API client.
 * Extends BaseApiClient, targeting the OpenEye server (port 8000).
 */

import { BaseApiClient } from "./base-api-client";
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

export class MLOpsClient extends BaseApiClient {
  // ── Registry ─────────────────────────────────────────────────

  async listModels(): Promise<ModelRegistryEntry[]> {
    return this.request("/mlops/models");
  }

  async listExports(): Promise<ExportResult[]> {
    return this.request("/mlops/exports");
  }

  // ── Lifecycle ────────────────────────────────────────────────

  async listPromotions(): Promise<PromotionRecord[]> {
    return this.request("/mlops/promotions");
  }

  async listValidationRuns(): Promise<ValidationTestRun[]> {
    return this.request("/mlops/validation-runs");
  }

  // ── A/B Testing ──────────────────────────────────────────────

  async listABTests(): Promise<ABTestResult[]> {
    return this.request("/mlops/ab-tests");
  }

  // ── Operations ───────────────────────────────────────────────

  async listRetrainingRuns(): Promise<RetrainingRun[]> {
    return this.request("/mlops/retraining/runs");
  }

  async listBatchJobs(): Promise<BatchInferenceJob[]> {
    return this.request("/mlops/batch-inference");
  }

  // ── Shadow Deployments ───────────────────────────────────────

  async listShadowDeployments(): Promise<ShadowDeployment[]> {
    return this.request("/mlops/shadow-deployments");
  }

  // ── Feedback & Annotations ───────────────────────────────────

  async listAnnotations(): Promise<InferenceFailureAnnotation[]> {
    return this.request("/mlops/annotations");
  }

  async listFeedbackBatches(): Promise<FeedbackBatch[]> {
    return this.request("/mlops/feedback-batches");
  }

  // ── Lineage ──────────────────────────────────────────────────

  async listLineage(): Promise<ModelLineage[]> {
    return this.request("/mlops/lineage");
  }
}
