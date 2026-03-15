"""Fleet & Device Management Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────


class DeviceStatus(str, Enum):
    PENDING = "pending"
    ONLINE = "online"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"
    ERROR = "error"
    DECOMMISSIONED = "decommissioned"


class DeviceType(str, Enum):
    CAMERA = "camera"
    ROBOT = "robot"
    EDGE_NODE = "edge_node"
    GATEWAY = "gateway"
    DRONE = "drone"


class DeploymentStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"
    FAILED = "failed"


class DeploymentStrategy(str, Enum):
    CANARY = "canary"
    ROLLING = "rolling"
    BLUE_GREEN = "blue_green"
    ALL_AT_ONCE = "all_at_once"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertType(str, Enum):
    DEVICE_OFFLINE = "device_offline"
    HIGH_RESOURCE_USAGE = "high_resource_usage"
    DEPLOYMENT_FAILED = "deployment_failed"
    OTA_FAILED = "ota_failed"
    HEARTBEAT_MISSED = "heartbeat_missed"
    TEMPERATURE_HIGH = "temperature_high"
    DISK_FULL = "disk_full"


class CommandType(str, Enum):
    RESTART = "restart"
    UPDATE_CONFIG = "update_config"
    DEPLOY_MODEL = "deploy_model"
    ROLLBACK_MODEL = "rollback_model"
    OTA_UPDATE = "ota_update"
    DECOMMISSION = "decommission"
    COLLECT_LOGS = "collect_logs"


class CommandStatus(str, Enum):
    PENDING = "pending"
    ACKED = "acked"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


# ── Hardware & Resources ───────────────────────────────────────


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


# ── Device ─────────────────────────────────────────────────────


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


# ── Heartbeat ──────────────────────────────────────────────────


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


# ── Deployments ────────────────────────────────────────────────


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


# ── Device Groups ──────────────────────────────────────────────


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


# ── Maintenance ────────────────────────────────────────────────


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


# ── OTA Updates ────────────────────────────────────────────────


class OTAUpdateRequest(BaseModel):
    device_ids: List[str] = Field(description="Target device UUIDs")
    firmware_url: str = Field(description="Download URL for firmware")
    firmware_version: str = Field(description="Target firmware version string")
    checksum: str = Field(description="SHA-256 checksum of firmware file")
    bandwidth_limit_mbps: Optional[float] = Field(default=None)
    force: bool = Field(default=False, description="Skip version check")


# ── Decommission ───────────────────────────────────────────────


class DecommissionRequest(BaseModel):
    reason: str = Field(default="", description="Reason for decommissioning")
    wipe_data: bool = Field(default=False, description="Wipe device data")


# ── Alerts ─────────────────────────────────────────────────────


class FleetAlertResponse(BaseModel):
    id: str
    user_id: str
    device_id: Optional[str] = None
    deployment_id: Optional[str] = None
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    created_at: datetime


# ── Batch Operations ───────────────────────────────────────────


class BatchDeviceRequest(BaseModel):
    tag_filter: Dict[str, str] = Field(description="Match devices with these tags")
    action: str = Field(description="Action to perform: restart, update_config, decommission")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Action-specific payload")


# ── Hosted API Models ─────────────────────────────────────────


class BBox(BaseModel):
    x: float = Field(description="Left edge (0-1)")
    y: float = Field(description="Top edge (0-1)")
    w: float = Field(description="Width (0-1)")
    h: float = Field(description="Height (0-1)")


class DetectedObjectResponse(BaseModel):
    label: str = Field(description="Class label")
    confidence: float = Field(description="Detection confidence (0-1)")
    bbox: BBox = Field(description="Normalized bounding box")


class ImageInfoResponse(BaseModel):
    width: int = Field(description="Image width in pixels")
    height: int = Field(description="Image height in pixels")


class DetectResponse(BaseModel):
    model: str = "yolov8"
    objects: List[DetectedObjectResponse] = Field(default_factory=list)
    image: ImageInfoResponse
    inference_ms: float = Field(description="Inference time in milliseconds")
    credits_used: int = 1


class DepthResponse(BaseModel):
    model: str = "depth-anything-v2"
    depth_map: str = Field(description="Base64-encoded PNG depth map")
    image: ImageInfoResponse
    inference_ms: float = Field(description="Inference time in milliseconds")
    credits_used: int = 2


class DescribeResponse(BaseModel):
    model: str = "gpt-4o"
    description: str = Field(description="Natural language scene description")
    image: ImageInfoResponse
    inference_ms: float = Field(description="Inference time in milliseconds")
    credits_used: int = 3


class ModelInfo(BaseModel):
    id: str = Field(description="Model identifier")
    name: str = Field(description="Human-readable model name")
    task: str = Field(description="Task type (detection, depth, description)")
    credits_per_call: int = Field(description="Credit cost per API call")
    description: str = Field(default="", description="Model description")


class UsageResponse(BaseModel):
    balance: int = Field(description="Current credit balance")
    total_requests: int = Field(default=0, description="Total API requests in period")
    total_credits_used: int = Field(default=0, description="Total credits used in period")
    by_endpoint: Dict[str, int] = Field(default_factory=dict, description="Request counts by endpoint")
    daily_credits: Dict[str, int] = Field(default_factory=dict, description="Credits used per day")
    truncated: bool = Field(default=False, description="True if usage data exceeds 1,000 rows and was truncated")


class ErrorResponse(BaseModel):
    error: str = Field(description="Error type")
    message: str = Field(description="Human-readable error message")
    status_code: int = Field(description="HTTP status code")
