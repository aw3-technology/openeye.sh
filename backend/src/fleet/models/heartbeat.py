"""Heartbeat-related Pydantic models."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .device import ResourceUsage
from .enums import CommandType


class HeartbeatRequest(BaseModel):
    device_id: str = Field(description="Device UUID")
    resource_usage: ResourceUsage = Field(default_factory=ResourceUsage)
    firmware_version: Optional[str] = None
    model_version: Optional[str] = None
    agent_version: Optional[str] = None
    ip_address: Optional[str] = None


class PendingCommand(BaseModel):
    id: str
    command_type: CommandType
    payload: Dict[str, Any] = Field(default_factory=dict)


class HeartbeatResponse(BaseModel):
    status: str = Field(default="ok")
    server_time: datetime
    pending_commands: List[PendingCommand] = Field(default_factory=list)
