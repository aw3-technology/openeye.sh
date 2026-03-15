"""Pydantic schemas for Model Lifecycle & MLOps (stories 181-192).

All schemas are re-exported here for backward compatibility.
"""

from .enums import (
    ABTestStatus,
    AnnotationLabel,
    ApprovalStatus,
    BatchJobStatus,
    ExportFormat,
    HardwareTarget,
    ModelFormat,
    ModelStage,
    PipelineStatus,
    RetrainingTrigger,
    ShadowStatus,
    StorageBackend,
)
from .registry import (
    ModelRegistryEntry,
    ModelUploadRequest,
    ModelVersion,
    TrainingMetrics,
)
from .lifecycle import (
    ApprovalGate,
    PromotionRecord,
    PromotionRequest,
)
from .testing import (
    ABTestConfig,
    ABTestMetrics,
    ABTestResult,
)
from .pipelines import (
    BatchInferenceConfig,
    BatchInferenceJob,
    BatchInferenceProgress,
    DriftDetectionConfig,
    RetrainingPipelineConfig,
    RetrainingRun,
)
from .evaluation import (
    BenchmarkMatrixResult,
    HardwareBenchmarkEntry,
    ValidationConditionResult,
    ValidationTest,
    ValidationTestRun,
)
from .deployment import (
    ExportRequest,
    ExportResult,
    ModelLineage,
    ShadowComparisonMetrics,
    ShadowDeployment,
    ShadowDeploymentConfig,
)
from .feedback import (
    FeedbackBatch,
    InferenceFailureAnnotation,
)

__all__ = [
    # enums
    "ABTestStatus",
    "AnnotationLabel",
    "ApprovalStatus",
    "BatchJobStatus",
    "ExportFormat",
    "HardwareTarget",
    "ModelFormat",
    "ModelStage",
    "PipelineStatus",
    "RetrainingTrigger",
    "ShadowStatus",
    "StorageBackend",
    # registry
    "ModelRegistryEntry",
    "ModelUploadRequest",
    "ModelVersion",
    "TrainingMetrics",
    # lifecycle
    "ApprovalGate",
    "PromotionRecord",
    "PromotionRequest",
    # testing
    "ABTestConfig",
    "ABTestMetrics",
    "ABTestResult",
    # pipelines
    "BatchInferenceConfig",
    "BatchInferenceJob",
    "BatchInferenceProgress",
    "DriftDetectionConfig",
    "RetrainingPipelineConfig",
    "RetrainingRun",
    # evaluation
    "BenchmarkMatrixResult",
    "HardwareBenchmarkEntry",
    "ValidationConditionResult",
    "ValidationTest",
    "ValidationTestRun",
    # deployment
    "ExportRequest",
    "ExportResult",
    "ModelLineage",
    "ShadowComparisonMetrics",
    "ShadowDeployment",
    "ShadowDeploymentConfig",
    # feedback
    "FeedbackBatch",
    "InferenceFailureAnnotation",
]
