"""Device group Pydantic models."""

from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field

class AutoScalingPolicy(BaseModel):
    enabled: bool = Field(default=False)
    min_devices: int = Field(default=1, ge=1)
    max_devices: int = Field(default=10, ge=1)
    target_cpu_percent: float = Field(default=70, ge=0, le=100)
    scale_up_threshold: float = Field(default=80, ge=0, le=100)
    scale_down_threshold: float = Field(default=30, ge=0, le=100)
    cooldown_seconds: int = Field(default=300, ge=0)


class DeviceGroupCreateRequest(BaseModel):
    name: str = Field(description="Group name")
    description: str = Field(default="", description="Group description")
    tag_filter: Dict[str, str] = Field(default_factory=dict, description="Auto-match devices by tags")


class DeviceGroupResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str
    tag_filter: Dict[str, str] = Field(default_factory=dict)
    auto_scaling_policy: Optional[AutoScalingPolicy] = None
    device_count: int = 0
    created_at: datetime
    updated_at: datetime
