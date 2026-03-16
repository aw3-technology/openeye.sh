"""Pydantic schemas for Model Lifecycle & MLOps (stories 181-192)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Enums ─────────────────────────────────────────────────────────────


class ModelFormat(str, Enum):
    ONNX = "onnx"
    TORCHSCRIPT = "torchscript"
    SAFETENSORS = "safetensors"
    TENSORRT = "tensorrt"
    COREML = "coreml"
    PYTORCH = "pytorch"


class ModelStage(str, Enum):
    DEV = "dev"
    STAGING = "staging"
    PRODUCTION = "production"
    ARCHIVED = "archived"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ABTestStatus(str, Enum):
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RetrainingTrigger(str, Enum):
    ACCURACY_DRIFT = "accuracy_drift"
    SCHEDULED = "scheduled"
    MANUAL = "manual"
    DATA_VOLUME = "data_volume"


class PipelineStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BatchJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StorageBackend(str, Enum):
    S3 = "s3"
    GCS = "gcs"
    LOCAL = "local"


class HardwareTarget(str, Enum):
    JETSON = "jetson"
    A100 = "a100"
    T4 = "t4"
    CPU = "cpu"
    MPS = "mps"
    TENSORRT = "tensorrt"


class ExportFormat(str, Enum):
    ONNX = "onnx"
    TENSORRT = "tensorrt"
    COREML = "coreml"


class ShadowStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class AnnotationLabel(str, Enum):
    FALSE_POSITIVE = "false_positive"
    FALSE_NEGATIVE = "false_negative"
    MISCLASSIFICATION = "misclassification"
    WRONG_BBOX = "wrong_bbox"
    LOW_CONFIDENCE = "low_confidence"


# ── Story 181: Upload custom model + register ────────────────────────


_SAFE_KEY_RE = r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$"


class ModelUploadRequest(BaseModel):
    """Request to upload and register a custom-trained model."""

    name: str = Field(description="Human-readable model name")
    key: str = Field(description="Registry key (slug)", pattern=_SAFE_KEY_RE)
    format: ModelFormat
    task: str = Field(description="e.g. detection, depth, segmentation")
    description: str = ""
    author: str = ""
    tags: list[str] = Field(default_factory=list)
    file_path: str = Field(description="Path to model file (ONNX, TorchScript, SafeTensors)")
    adapter: str = Field(default="onnx_generic", description="Adapter key or custom path")


# ── Story 182: Version metadata tracking ─────────────────────────────


class TrainingMetrics(BaseModel):
    """Metrics from a training run."""

    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    mAP: Optional[float] = None
    loss: Optional[float] = None
    epochs: Optional[int] = None
    custom: dict[str, float] = Field(default_factory=dict)


class ModelVersion(BaseModel):
    """A single version of a model in the registry."""

    version: str = Field(description="Semantic version, e.g. 1.0.0", pattern=_SAFE_KEY_RE)
    model_key: str = Field(pattern=_SAFE_KEY_RE)
    format: ModelFormat
    file_path: str
    file_size_mb: float = 0.0
    checksum: Optional[str] = None
    stage: ModelStage = ModelStage.DEV
    author: str = ""
    changelog: str = ""
    training_dataset: str = Field(default="", description="Dataset name or path used for training")
    training_metrics: TrainingMetrics = Field(default_factory=TrainingMetrics)
    hyperparameters: dict[str, Any] = Field(default_factory=dict)
    code_commit: str = Field(default="", description="Git commit SHA that produced this version")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict[str, Any] = Field(default_factory=dict)


class ModelRegistryEntry(BaseModel):
    """Enterprise registry entry with full version history."""

    key: str
    name: str
    task: str
    description: str = ""
    adapter: str
    tags: list[str] = Field(default_factory=list)
    versions: list[ModelVersion] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def latest_version(self) -> Optional[ModelVersion]:
        return self.versions[-1] if self.versions else None

    @property
    def production_version(self) -> Optional[ModelVersion]:
        for v in reversed(self.versions):
            if v.stage == ModelStage.PRODUCTION:
                return v
        return None


# ── Story 183: Stage promotion + approval gates ──────────────────────


class ApprovalGate(BaseModel):
    """An approval gate for stage promotion."""

    from_stage: ModelStage
    to_stage: ModelStage
    required_approvers: list[str] = Field(default_factory=list)
    auto_approve_if: Optional[str] = Field(
        default=None,
        description="Condition expression, e.g. 'accuracy > 0.95 and latency_ms < 50'",
    )


class PromotionRequest(BaseModel):
    """Request to promote a model version to a new stage."""

    model_key: str
    version: str
    target_stage: ModelStage
    requester: str
    reason: str = ""


class PromotionRecord(BaseModel):
    """Record of a stage promotion."""

    model_key: str
    version: str
    from_stage: ModelStage
    to_stage: ModelStage
    status: ApprovalStatus = ApprovalStatus.PENDING
    requester: str = ""
    approver: Optional[str] = None
    reason: str = ""
    reviewed_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Story 184: A/B testing ───────────────────────────────────────────


class ABTestConfig(BaseModel):
    """Configuration for an A/B test between two model versions."""

    name: str
    model_key: str
    version_a: str = Field(description="Control version")
    version_b: str = Field(description="Challenger version")
    traffic_split: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Fraction of traffic to version B"
    )
    max_samples: Optional[int] = Field(default=None, description="Stop after N samples")
    duration_hours: Optional[float] = Field(default=None, description="Stop after N hours")

    @model_validator(mode="after")
    def _versions_differ(self):
        if self.version_a == self.version_b:
            raise ValueError("version_a and version_b must be different")
        return self


class ABTestMetrics(BaseModel):
    """Aggregated metrics for one side of an A/B test."""

    version: str
    samples: int = 0
    mean_accuracy: float = 0.0
    mean_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    error_rate: float = 0.0
    custom_metrics: dict[str, float] = Field(default_factory=dict)


class ABTestResult(BaseModel):
    """Full A/B test state and results."""

    id: str
    config: ABTestConfig
    status: ABTestStatus = ABTestStatus.RUNNING
    metrics_a: ABTestMetrics = Field(default_factory=lambda: ABTestMetrics(version=""))
    metrics_b: ABTestMetrics = Field(default_factory=lambda: ABTestMetrics(version=""))
    winner: Optional[str] = None
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None


# ── Story 185: Automated retraining pipelines ────────────────────────


class DriftDetectionConfig(BaseModel):
    """Configuration for accuracy drift detection."""

    metric: str = Field(default="accuracy", description="Metric to monitor")
    threshold: float = Field(default=0.05, description="Drift threshold (e.g. 5% drop)")
    window_size: int = Field(default=1000, description="Number of recent inferences to evaluate")
    check_interval_minutes: int = 60


class RetrainingPipelineConfig(BaseModel):
    """Configuration for an automated retraining pipeline."""

    name: str
    model_key: str
    trigger: RetrainingTrigger = RetrainingTrigger.ACCURACY_DRIFT
    drift_config: Optional[DriftDetectionConfig] = None
    schedule_cron: Optional[str] = Field(default=None, description="Cron expression for scheduled trigger")
    training_script: str = Field(description="Path to training script or command")
    training_args: dict[str, Any] = Field(default_factory=dict)
    dataset_path: str = ""
    auto_promote_to: Optional[ModelStage] = Field(
        default=None, description="Auto-promote after successful retrain"
    )
    validation_tests: list[str] = Field(
        default_factory=list, description="Validation test IDs that must pass"
    )


class RetrainingRun(BaseModel):
    """A single execution of a retraining pipeline."""

    id: str
    pipeline_name: str
    model_key: str
    trigger: RetrainingTrigger
    status: PipelineStatus = PipelineStatus.IDLE
    triggered_by: str = Field(default="", description="drift_detector, scheduler, or user")
    new_version: Optional[str] = None
    metrics: Optional[TrainingMetrics] = None
    logs: list[str] = Field(default_factory=list)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Story 186: Batch inference ───────────────────────────────────────


class BatchInferenceConfig(BaseModel):
    """Configuration for a batch inference job."""

    name: str
    model_key: str
    model_version: str
    input_path: str = Field(description="Path to dataset (local dir, S3 URI, or GCS URI)")
    output_path: str = Field(description="Where to write results (S3/GCS/local)")
    storage_backend: StorageBackend = StorageBackend.LOCAL
    batch_size: int = Field(default=32, ge=1)
    max_workers: int = Field(default=4, ge=1)
    output_format: str = Field(default="jsonl", description="jsonl, csv, or parquet")
    filters: dict[str, Any] = Field(
        default_factory=dict, description="E.g. file_type=png, max_size_mb=10"
    )


class BatchInferenceProgress(BaseModel):
    """Progress tracking for a batch inference job."""

    total_images: int = 0
    processed: int = 0
    failed: int = 0
    elapsed_seconds: float = 0.0
    images_per_second: float = 0.0
    estimated_remaining_seconds: float = 0.0


class BatchInferenceJob(BaseModel):
    """A batch inference job."""

    id: str
    config: BatchInferenceConfig
    status: BatchJobStatus = BatchJobStatus.QUEUED
    progress: BatchInferenceProgress = Field(default_factory=BatchInferenceProgress)
    result_path: Optional[str] = None
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


# ── Story 187: Cross-hardware benchmark matrix ───────────────────────


class HardwareBenchmarkEntry(BaseModel):
    """Benchmark results for a single model on a single hardware target."""

    hardware: HardwareTarget
    mean_latency_ms: float
    median_latency_ms: float
    p95_latency_ms: float
    throughput_fps: float
    memory_mb: float = 0.0
    power_watts: Optional[float] = None


class BenchmarkMatrixResult(BaseModel):
    """Complete benchmark matrix for a model across hardware targets."""

    model_key: str
    model_version: str
    image_size: tuple[int, int] = (640, 480)
    runs_per_target: int = 100
    entries: list[HardwareBenchmarkEntry] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Story 188: Model validation tests ────────────────────────────────


class ValidationTest(BaseModel):
    """A model validation test that must pass before deployment."""

    id: str
    name: str
    model_key: str
    description: str = ""
    test_dataset: str = Field(description="Path to test dataset")
    conditions: list[str] = Field(
        description='Conditions like "accuracy > 0.95", "latency_ms < 50", "mAP > 0.80"'
    )
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ValidationConditionResult(BaseModel):
    """Result of evaluating a single validation condition."""

    condition: str
    actual_value: float
    passed: bool


class ValidationTestRun(BaseModel):
    """Result of running a validation test against a model version."""

    test_id: str
    model_key: str
    model_version: str
    passed: bool
    condition_results: list[ValidationConditionResult] = Field(default_factory=list)
    run_duration_seconds: float = 0.0
    run_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Story 189: Model lineage ─────────────────────────────────────────


class ModelLineage(BaseModel):
    """Full lineage record for a model version."""

    model_key: str
    version: str
    dataset: str = Field(description="Training dataset name/path")
    dataset_version: str = ""
    dataset_size: Optional[int] = Field(default=None, description="Number of samples")
    hyperparameters: dict[str, Any] = Field(default_factory=dict)
    code_commit: str = Field(description="Git SHA of training code")
    code_repo: str = ""
    code_branch: str = ""
    training_framework: str = Field(default="", description="e.g. PyTorch 2.1, TF 2.15")
    training_duration_seconds: Optional[float] = None
    parent_model: Optional[str] = Field(
        default=None, description="Version this was fine-tuned from"
    )
    environment: dict[str, str] = Field(
        default_factory=dict, description="CUDA version, Python version, etc."
    )
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Story 190: Model export ──────────────────────────────────────────


class ExportRequest(BaseModel):
    """Request to export a model to a target format."""

    model_key: str
    model_version: str
    target_format: ExportFormat
    output_path: Optional[str] = Field(default=None, description="Override output location")
    opset_version: Optional[int] = Field(default=None, description="ONNX opset version")
    quantize: bool = Field(default=False, description="Apply INT8 quantization")
    input_shape: Optional[list[int]] = Field(
        default=None, description="e.g. [1, 3, 640, 640]"
    )


class ExportResult(BaseModel):
    """Result of a model export."""

    model_key: str
    model_version: str
    source_format: ModelFormat
    target_format: ExportFormat
    output_path: str
    output_size_mb: float
    quantized: bool = False
    export_duration_seconds: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Story 191: Shadow mode ───────────────────────────────────────────


class ShadowDeploymentConfig(BaseModel):
    """Configuration for shadow mode deployment."""

    name: str
    model_key: str
    production_version: str = Field(description="Currently serving version")
    shadow_version: str = Field(description="New version running in shadow")
    sample_rate: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Fraction of traffic to shadow"
    )
    max_samples: Optional[int] = None
    compare_metrics: list[str] = Field(
        default_factory=lambda: ["accuracy", "latency_ms"],
        description="Metrics to compare between production and shadow",
    )

    @model_validator(mode="after")
    def _versions_differ(self):
        if self.production_version == self.shadow_version:
            raise ValueError("production_version and shadow_version must be different")
        return self


class ShadowComparisonMetrics(BaseModel):
    """Side-by-side comparison of production vs shadow model."""

    production_version: str
    shadow_version: str
    total_samples: int = 0
    agreement_rate: float = Field(default=0.0, description="How often outputs match")
    production_mean_latency_ms: float = 0.0
    shadow_mean_latency_ms: float = 0.0
    production_accuracy: Optional[float] = None
    shadow_accuracy: Optional[float] = None
    divergent_samples: list[str] = Field(
        default_factory=list, description="IDs of samples where outputs differ"
    )


class ShadowDeployment(BaseModel):
    """A shadow mode deployment."""

    id: str
    config: ShadowDeploymentConfig
    status: ShadowStatus = ShadowStatus.ACTIVE
    comparison: ShadowComparisonMetrics = Field(
        default_factory=lambda: ShadowComparisonMetrics(
            production_version="", shadow_version=""
        )
    )
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None


# ── Story 192: Inference failure annotation + feedback loop ──────────


class InferenceFailureAnnotation(BaseModel):
    """Annotation of an inference failure for correction feedback."""

    id: str
    model_key: str
    model_version: str
    image_source: str = Field(description="Path or URI of the input image")
    predicted_label: Optional[str] = None
    predicted_confidence: Optional[float] = None
    correct_label: str = Field(description="Ground-truth label provided by annotator")
    correct_bbox: Optional[dict[str, float]] = Field(
        default=None, description="Corrected bounding box {x, y, w, h}"
    )
    annotation_label: AnnotationLabel
    annotator: str = ""
    notes: str = ""
    fed_back: bool = Field(default=False, description="Whether this has been added to training data")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class FeedbackBatch(BaseModel):
    """A batch of annotations to feed back into the training pipeline."""

    id: str
    model_key: str
    annotations: list[str] = Field(description="List of annotation IDs")
    total_annotations: int = 0
    output_dataset_path: str = Field(description="Path to generated correction dataset")
    status: PipelineStatus = PipelineStatus.IDLE
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    error: Optional[str] = None


# ── Model evaluation metrics ─────────────────────────────────────────


class EvaluationMetrics(BaseModel):
    """Aggregated evaluation metrics (precision/recall/mAP)."""

    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0
    mAP: float = 0.0
    total_images: int = 0
    total_predictions: int = 0
    total_ground_truth: int = 0
    per_class: dict[str, float] = Field(default_factory=dict, description="Per-class AP")
