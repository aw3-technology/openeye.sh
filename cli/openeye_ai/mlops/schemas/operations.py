"""A/B testing, retraining, batch, benchmark, and feedback schemas (stories 184-187, 192)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator

from .base import (
    ABTestStatus,
    AnnotationLabel,
    BatchJobStatus,
    HardwareTarget,
    ModelStage,
    PipelineStatus,
    RetrainingTrigger,
    StorageBackend,
    TrainingMetrics,
)


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
