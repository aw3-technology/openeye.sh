"""Enums and cross-cutting metrics models for MLOps schemas."""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


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


# ── Shared constant ──────────────────────────────────────────────────

_SAFE_KEY_RE = r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$"


# ── Cross-cutting metrics models ─────────────────────────────────────


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
