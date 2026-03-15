"""Schemas for model upload, versions, and registry (stories 181-182)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from .enums import ModelFormat, ModelStage, SAFE_KEY_RE

class ModelUploadRequest(BaseModel):
    """Request to upload and register a custom-trained model."""

    name: str = Field(description="Human-readable model name")
    key: str = Field(description="Registry key (slug)", pattern=SAFE_KEY_RE)
    format: ModelFormat
    task: str = Field(description="e.g. detection, depth, segmentation")
    description: str = ""
    author: str = ""
    tags: list[str] = Field(default_factory=list)
    file_path: str = Field(description="Path to model file (ONNX, TorchScript, SafeTensors)")
    adapter: str = Field(default="onnx_generic", description="Adapter key or custom path")

class TrainingMetrics(BaseModel):
    """Metrics from a training run."""

    accuracy: float | None = None
    precision: float | None = None
    recall: float | None = None
    f1: float | None = None
    mAP: float | None = None
    loss: float | None = None
    epochs: int | None = None
    custom: dict[str, float] = Field(default_factory=dict)

class ModelVersion(BaseModel):
    """A single version of a model in the registry."""

    version: str = Field(description="Semantic version, e.g. 1.0.0", pattern=SAFE_KEY_RE)
    model_key: str = Field(pattern=SAFE_KEY_RE)
    format: ModelFormat
    file_path: str
    file_size_mb: float = 0.0
    checksum: str | None = None
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
    def latest_version(self) -> ModelVersion | None:
        return self.versions[-1] if self.versions else None

    @property
    def production_version(self) -> ModelVersion | None:
        for v in reversed(self.versions):
            if v.stage == ModelStage.PRODUCTION:
                return v
        return None
