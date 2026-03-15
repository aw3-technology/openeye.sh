"""Schemas for retraining pipelines and batch inference (stories 185-186)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from .enums import (
    BatchJobStatus,
    ModelStage,
    PipelineStatus,
    RetrainingTrigger,
    StorageBackend,
)
from .registry import TrainingMetrics

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
    drift_config: DriftDetectionConfig | None = None
    schedule_cron: str | None = Field(default=None, description="Cron expression for scheduled trigger")
    training_script: str = Field(description="Path to training script or command")
    training_args: dict[str, Any] = Field(default_factory=dict)
    dataset_path: str = ""
    auto_promote_to: ModelStage | None = Field(
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
    new_version: str | None = None
    metrics: TrainingMetrics | None = None
    logs: list[str] = Field(default_factory=list)
    started_at: str | None = None
    completed_at: str | None = None
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
    result_path: str | None = None
    error: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: str | None = None
    completed_at: str | None = None
