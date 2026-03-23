"""Maintenance window Pydantic models."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class MaintenanceWindowCreateRequest(BaseModel):
    name: str = Field(description="Maintenance window name")
    description: str = Field(default="")
    device_ids: List[str] = Field(default_factory=list)
    group_id: Optional[str] = None
    starts_at: datetime
    ends_at: datetime
    recurrence: Optional[str] = Field(default=None, description="Cron or RRULE string")


class MaintenanceWindowResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str
    device_ids: List[str] = Field(default_factory=list)
    group_id: Optional[str] = None
    starts_at: datetime
    ends_at: datetime
    recurrence: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
