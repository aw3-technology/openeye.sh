"""Enums and constants for MLOps schemas."""

from __future__ import annotations

from enum import Enum

# Shared regex for safe registry keys
SAFE_KEY_RE = r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$"


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
