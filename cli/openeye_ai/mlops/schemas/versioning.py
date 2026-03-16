"""Model identity, versions, lineage, and export schemas (stories 181-182, 189-190)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field

from .base import (
    ExportFormat,
    ModelFormat,
    ModelStage,
    TrainingMetrics,
    _SAFE_KEY_RE,
)


# ── Story 181: Upload custom model + register ────────────────────────


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
