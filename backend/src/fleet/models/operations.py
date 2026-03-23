"""OTA, decommission, and batch operation Pydantic models."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class OTAUpdateRequest(BaseModel):
    device_ids: List[str] = Field(description="Target device UUIDs")
    firmware_url: str = Field(description="Download URL for firmware")
    firmware_version: str = Field(description="Target firmware version string")
    checksum: str = Field(description="SHA-256 checksum of firmware file")
    bandwidth_limit_mbps: Optional[float] = Field(default=None)
    force: bool = Field(default=False, description="Skip version check")


class DecommissionRequest(BaseModel):
    reason: str = Field(default="", description="Reason for decommissioning")
    wipe_data: bool = Field(default=False, description="Wipe device data")


class BatchDeviceRequest(BaseModel):
    tag_filter: Dict[str, str] = Field(description="Match devices with these tags")
    action: str = Field(description="Action to perform: restart, update_config, decommission")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Action-specific payload")
