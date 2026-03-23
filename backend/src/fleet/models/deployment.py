"""Deployment-related Pydantic models."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from .enums import DeploymentStatus, DeploymentStrategy


class RolloutStage(BaseModel):
    name: str = Field(description="Stage name, e.g. 'canary-10%'")
    percentage: float = Field(ge=0, le=100, description="% of target devices")
    min_wait_seconds: int = Field(default=300, description="Minimum wait before advancing")


class DeploymentCreateRequest(BaseModel):
    name: str = Field(description="Deployment name")
    model_id: str = Field(description="Model identifier to deploy")
    model_version: str = Field(description="Model version string")
    model_url: Optional[str] = Field(default=None, description="Download URL for model artifact")
    model_checksum: Optional[str] = Field(default=None, description="SHA-256 checksum")
    strategy: DeploymentStrategy = Field(default=DeploymentStrategy.CANARY)
    rollout_stages: List[RolloutStage] = Field(
        default_factory=lambda: [
            RolloutStage(name="canary", percentage=10, min_wait_seconds=300),
            RolloutStage(name="rollout-50", percentage=50, min_wait_seconds=600),
            RolloutStage(name="full", percentage=100, min_wait_seconds=0),
        ],
        description="Staged rollout plan",
    )
    target_device_ids: List[str] = Field(default_factory=list, description="Specific device UUIDs")
    target_group_id: Optional[str] = Field(default=None, description="Target device group")
    bandwidth_limit_mbps: Optional[float] = Field(default=None, description="Download bandwidth limit")


class DeploymentResponse(BaseModel):
    id: str
    user_id: str
    name: str
    model_id: str
    model_version: str
    model_url: Optional[str] = None
    model_checksum: Optional[str] = None
    strategy: DeploymentStrategy
    status: DeploymentStatus
    rollout_stages: List[RolloutStage] = Field(default_factory=list)
    current_stage: int = 0
    target_device_ids: List[str] = Field(default_factory=list)
    target_group_id: Optional[str] = None
    bandwidth_limit_mbps: Optional[float] = None
    rollback_version: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class DeploymentDeviceStatusResponse(BaseModel):
    id: str
    deployment_id: str
    device_id: str
    status: str
    stage: int = 0
    progress: float = 0
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
