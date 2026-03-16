"""Promotion, validation, and shadow mode schemas (stories 183, 188, 191)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator

from .base import ApprovalStatus, ModelStage, PipelineStatus, ShadowStatus


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
