"""Schemas for lineage, export, and shadow mode (stories 189-191)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, model_validator

from .enums import ExportFormat, ModelFormat, ShadowStatus

# ── Story 189: Model lineage ─────────────────────────────────────────

class ModelLineage(BaseModel):
    """Full lineage record for a model version."""

    model_key: str
    version: str
    dataset: str = Field(description="Training dataset name/path")
    dataset_version: str = ""
    dataset_size: int | None = Field(default=None, description="Number of samples")
    hyperparameters: dict[str, Any] = Field(default_factory=dict)
    code_commit: str = Field(description="Git SHA of training code")
    code_repo: str = ""
    code_branch: str = ""
    training_framework: str = Field(default="", description="e.g. PyTorch 2.1, TF 2.15")
    training_duration_seconds: float | None = None
    parent_model: str | None = Field(
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
    output_path: str | None = Field(default=None, description="Override output location")
    opset_version: int | None = Field(default=None, description="ONNX opset version")
    quantize: bool = Field(default=False, description="Apply INT8 quantization")
    input_shape: list[int] | None = Field(
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
    max_samples: int | None = None
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
    production_accuracy: float | None = None
    shadow_accuracy: float | None = None
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
    completed_at: str | None = None
