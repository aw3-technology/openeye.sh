"""Pydantic schemas for Model Lifecycle & MLOps (stories 181-192).

All public names are re-exported here for backward compatibility.
``from openeye_ai.mlops.schemas import X`` continues to work.
"""

from .base import (
    ABTestStatus,
    AnnotationLabel,
    ApprovalStatus,
    BatchJobStatus,
    EvaluationMetrics,
    ExportFormat,
    HardwareTarget,
    ModelFormat,
    ModelStage,
    PipelineStatus,
    RetrainingTrigger,
    ShadowStatus,
    StorageBackend,
    TrainingMetrics,
    _SAFE_KEY_RE,
)
from .governance import (
    ApprovalGate,
    PromotionRecord,
    PromotionRequest,
    ShadowComparisonMetrics,
    ShadowDeployment,
    ShadowDeploymentConfig,
    ValidationConditionResult,
    ValidationTest,
    ValidationTestRun,
)
from .operations import (
    ABTestConfig,
    ABTestMetrics,
    ABTestResult,
    BatchInferenceConfig,
    BatchInferenceJob,
    BatchInferenceProgress,
    BenchmarkMatrixResult,
    DriftDetectionConfig,
    FeedbackBatch,
    HardwareBenchmarkEntry,
    InferenceFailureAnnotation,
    RetrainingPipelineConfig,
    RetrainingRun,
)
from .versioning import (
    ExportRequest,
    ExportResult,
    ModelLineage,
    ModelRegistryEntry,
    ModelUploadRequest,
    ModelVersion,
)

__all__ = [
    # base enums
    "ModelFormat",
    "ModelStage",
    "ApprovalStatus",
    "ABTestStatus",
    "RetrainingTrigger",
    "PipelineStatus",
    "BatchJobStatus",
    "StorageBackend",
    "HardwareTarget",
    "ExportFormat",
    "ShadowStatus",
    "AnnotationLabel",
    # base metrics
    "_SAFE_KEY_RE",
    "TrainingMetrics",
    "EvaluationMetrics",
    # versioning
    "ModelUploadRequest",
    "ModelVersion",
    "ModelRegistryEntry",
    "ModelLineage",
    "ExportRequest",
    "ExportResult",
    # governance
    "ApprovalGate",
    "PromotionRequest",
    "PromotionRecord",
    "ValidationTest",
    "ValidationConditionResult",
    "ValidationTestRun",
    "ShadowDeploymentConfig",
    "ShadowComparisonMetrics",
    "ShadowDeployment",
    # operations
    "ABTestConfig",
    "ABTestMetrics",
    "ABTestResult",
    "DriftDetectionConfig",
    "RetrainingPipelineConfig",
    "RetrainingRun",
    "BatchInferenceConfig",
    "BatchInferenceProgress",
    "BatchInferenceJob",
    "HardwareBenchmarkEntry",
    "BenchmarkMatrixResult",
    "InferenceFailureAnnotation",
    "FeedbackBatch",
]
