"""Schemas for stage promotion and approval gates (story 183)."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from .enums import ApprovalStatus, ModelStage

class ApprovalGate(BaseModel):
    """An approval gate for stage promotion."""

    from_stage: ModelStage
    to_stage: ModelStage
    required_approvers: list[str] = Field(default_factory=list)
    auto_approve_if: str | None = Field(
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
    approver: str | None = None
    reason: str = ""
    reviewed_at: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
