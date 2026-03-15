/** TypeScript mirrors of cli/openeye_ai/mlops/schemas.py — Model Lifecycle & MLOps types. */

// ── Enums ─────────────────────────────────────────────────────────────

export type ModelFormat =
  | "onnx"
  | "torchscript"
  | "safetensors"
  | "tensorrt"
  | "coreml"
  | "pytorch";

export type ModelStage = "dev" | "staging" | "production" | "archived";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ABTestStatus = "running" | "paused" | "completed" | "cancelled";

export type RetrainingTrigger =
  | "accuracy_drift"
  | "scheduled"
  | "manual"
  | "data_volume";

export type PipelineStatus = "idle" | "running" | "completed" | "failed";

export type BatchJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type StorageBackend = "s3" | "gcs" | "local";

export type HardwareTarget =
  | "jetson"
  | "a100"
  | "t4"
  | "cpu"
  | "mps"
  | "tensorrt";

export type ExportFormat = "onnx" | "tensorrt" | "coreml";

export type ShadowStatus = "active" | "paused" | "completed";

export type AnnotationLabel =
  | "false_positive"
  | "false_negative"
  | "misclassification"
  | "wrong_bbox"
  | "low_confidence";

// ── Story 181-182: Model Registry ─────────────────────────────────────

export interface TrainingMetrics {
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1?: number | null;
  mAP?: number | null;
  loss?: number | null;
  epochs?: number | null;
  custom: Record<string, number>;
}

export interface ModelVersion {
  version: string;
  model_key: string;
  format: ModelFormat;
  file_path: string;
  file_size_mb: number;
  checksum?: string | null;
  stage: ModelStage;
  author: string;
  changelog: string;
  training_dataset: string;
  training_metrics: TrainingMetrics;
  hyperparameters: Record<string, unknown>;
  code_commit: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface ModelRegistryEntry {
  key: string;
  name: string;
  task: string;
  description: string;
  adapter: string;
  tags: string[];
  versions: ModelVersion[];
  created_at: string;
  updated_at: string;
}

// ── Story 183: Stage Promotion ────────────────────────────────────────

export interface PromotionRecord {
  model_key: string;
  version: string;
  from_stage: ModelStage;
  to_stage: ModelStage;
  status: ApprovalStatus;
  requester: string;
  approver?: string | null;
  reason: string;
  reviewed_at?: string | null;
  created_at: string;
}

// ── Story 184: A/B Testing ────────────────────────────────────────────

export interface ABTestConfig {
  name: string;
  model_key: string;
  version_a: string;
  version_b: string;
  traffic_split: number;
  max_samples?: number | null;
  duration_hours?: number | null;
}

export interface ABTestMetrics {
  version: string;
  samples: number;
  mean_accuracy: number;
  mean_latency_ms: number;
  p95_latency_ms: number;
  error_rate: number;
  custom_metrics: Record<string, number>;
}

export interface ABTestResult {
  id: string;
  config: ABTestConfig;
  status: ABTestStatus;
  metrics_a: ABTestMetrics;
  metrics_b: ABTestMetrics;
  winner?: string | null;
  started_at: string;
  completed_at?: string | null;
}

// ── Story 185: Retraining Pipelines ──────────────────────────────────

export interface DriftDetectionConfig {
  metric: string;
  threshold: number;
  window_size: number;
  check_interval_minutes: number;
}

export interface RetrainingPipelineConfig {
  name: string;
  model_key: string;
  trigger: RetrainingTrigger;
  drift_config?: DriftDetectionConfig | null;
  schedule_cron?: string | null;
  training_script: string;
  training_args: Record<string, unknown>;
  dataset_path: string;
  auto_promote_to?: ModelStage | null;
  validation_tests: string[];
}

export interface RetrainingRun {
  id: string;
  pipeline_name: string;
  model_key: string;
  trigger: RetrainingTrigger;
  status: PipelineStatus;
  triggered_by: string;
  new_version?: string | null;
  metrics?: TrainingMetrics | null;
  logs: string[];
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

// ── Story 186: Batch Inference ───────────────────────────────────────

export interface BatchInferenceConfig {
  name: string;
  model_key: string;
  model_version: string;
  input_path: string;
  output_path: string;
  storage_backend: StorageBackend;
  batch_size: number;
  max_workers: number;
  output_format: string;
  filters: Record<string, unknown>;
}

export interface BatchInferenceProgress {
  total_images: number;
  processed: number;
  failed: number;
  elapsed_seconds: number;
  images_per_second: number;
  estimated_remaining_seconds: number;
}

export interface BatchInferenceJob {
  id: string;
  config: BatchInferenceConfig;
  status: BatchJobStatus;
  progress: BatchInferenceProgress;
  result_path?: string | null;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

// ── Story 187: Benchmark Matrix ─────────────────────────────────────

export interface HardwareBenchmarkEntry {
  hardware: HardwareTarget;
  mean_latency_ms: number;
  median_latency_ms: number;
  p95_latency_ms: number;
  throughput_fps: number;
  memory_mb: number;
  power_watts?: number | null;
}

export interface BenchmarkMatrixResult {
  model_key: string;
  model_version: string;
  image_size: [number, number];
  runs_per_target: number;
  entries: HardwareBenchmarkEntry[];
  created_at: string;
}

// ── Story 188: Validation Tests ─────────────────────────────────────

export interface ValidationTest {
  id: string;
  name: string;
  model_key: string;
  description: string;
  test_dataset: string;
  conditions: string[];
  created_at: string;
}

export interface ValidationConditionResult {
  condition: string;
  actual_value: number;
  passed: boolean;
}

export interface ValidationTestRun {
  test_id: string;
  model_key: string;
  model_version: string;
  passed: boolean;
  condition_results: ValidationConditionResult[];
  run_duration_seconds: number;
  run_at: string;
}

// ── Story 189: Model Lineage ────────────────────────────────────────

export interface ModelLineage {
  model_key: string;
  version: string;
  dataset: string;
  dataset_version: string;
  dataset_size?: number | null;
  hyperparameters: Record<string, unknown>;
  code_commit: string;
  code_repo: string;
  code_branch: string;
  training_framework: string;
  training_duration_seconds?: number | null;
  parent_model?: string | null;
  environment: Record<string, string>;
  created_at: string;
}

// ── Story 190: Model Export ─────────────────────────────────────────

export interface ExportResult {
  model_key: string;
  model_version: string;
  source_format: ModelFormat;
  target_format: ExportFormat;
  output_path: string;
  output_size_mb: number;
  quantized: boolean;
  export_duration_seconds: number;
  created_at: string;
}

// ── Story 191: Shadow Mode ──────────────────────────────────────────

export interface ShadowComparisonMetrics {
  production_version: string;
  shadow_version: string;
  total_samples: number;
  agreement_rate: number;
  production_mean_latency_ms: number;
  shadow_mean_latency_ms: number;
  production_accuracy?: number | null;
  shadow_accuracy?: number | null;
  divergent_samples: string[];
}

export interface ShadowDeployment {
  id: string;
  config: {
    name: string;
    model_key: string;
    production_version: string;
    shadow_version: string;
    sample_rate: number;
    max_samples?: number | null;
    compare_metrics: string[];
  };
  status: ShadowStatus;
  comparison: ShadowComparisonMetrics;
  started_at: string;
  completed_at?: string | null;
}

// ── Story 192: Feedback / Annotations ───────────────────────────────

export interface InferenceFailureAnnotation {
  id: string;
  model_key: string;
  model_version: string;
  image_source: string;
  predicted_label?: string | null;
  predicted_confidence?: number | null;
  correct_label: string;
  correct_bbox?: { x: number; y: number; w: number; h: number } | null;
  annotation_label: AnnotationLabel;
  annotator: string;
  notes: string;
  fed_back: boolean;
  created_at: string;
}

export interface FeedbackBatch {
  id: string;
  model_key: string;
  annotations: string[];
  total_annotations: number;
  output_dataset_path: string;
  status: PipelineStatus;
  created_at: string;
  completed_at?: string | null;
}
