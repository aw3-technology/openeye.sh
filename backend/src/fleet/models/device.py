"""Device-related Pydantic models."""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from .enums import DeviceStatus, DeviceType


class HardwareSpecs(BaseModel):
    cpu: str = Field(default="", description="CPU model name")
    cpu_cores: int = Field(default=0, description="Number of CPU cores")
    ram_gb: float = Field(default=0, description="RAM in GB")
    gpu: str = Field(default="", description="GPU model name")
    gpu_vram_gb: float = Field(default=0, description="GPU VRAM in GB")
    disk_gb: float = Field(default=0, description="Total disk in GB")
    architecture: str = Field(default="", description="CPU architecture (x86_64, arm64)")


class ResourceUsage(BaseModel):
    cpu_percent: float = Field(default=0, ge=0, le=100, description="CPU usage %")
    memory_percent: float = Field(default=0, ge=0, le=100, description="Memory usage %")
    memory_used_gb: float = Field(default=0, description="Memory used in GB")
    disk_percent: float = Field(default=0, ge=0, le=100, description="Disk usage %")
    disk_used_gb: float = Field(default=0, description="Disk used in GB")
    gpu_percent: Optional[float] = Field(default=None, description="GPU usage %")
    gpu_memory_percent: Optional[float] = Field(default=None, description="GPU memory usage %")
    gpu_temp_celsius: Optional[float] = Field(default=None, description="GPU temperature C")
    cpu_temp_celsius: Optional[float] = Field(default=None, description="CPU temperature C")


class DeviceRegisterRequest(BaseModel):
    name: str = Field(description="Human-readable device name")
    device_type: DeviceType = Field(default=DeviceType.EDGE_NODE, description="Device type")
    hardware_specs: Optional[HardwareSpecs] = Field(default=None, description="Hardware specifications")
    tags: Dict[str, str] = Field(default_factory=dict, description="Key-value tags")
    firmware_version: Optional[str] = Field(default=None, description="Current firmware version")
    ip_address: Optional[str] = Field(default=None, description="Device IP address")


class DeviceResponse(BaseModel):
    id: str
    user_id: str
    name: str
    device_type: DeviceType
    status: DeviceStatus
    api_key: Optional[str] = Field(default=None, description="Only returned on registration")
    hardware_specs: HardwareSpecs = Field(default_factory=HardwareSpecs)
    tags: Dict[str, str] = Field(default_factory=dict)
    config_overrides: Dict[str, Any] = Field(default_factory=dict)
    firmware_version: Optional[str] = None
    current_model_id: Optional[str] = None
    current_model_version: Optional[str] = None
    ip_address: Optional[str] = None
    last_heartbeat_at: Optional[datetime] = None
    registered_at: datetime
    created_at: datetime
    updated_at: datetime


class DeviceUpdateRequest(BaseModel):
    name: Optional[str] = None
    device_type: Optional[DeviceType] = None
    tags: Optional[Dict[str, str]] = None
    config_overrides: Optional[Dict[str, Any]] = None
    firmware_version: Optional[str] = None
