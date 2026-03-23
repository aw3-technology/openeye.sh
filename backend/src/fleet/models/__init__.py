"""Fleet & Device Management Pydantic models.

This package re-exports every public name so that existing
``from ..models import X`` imports continue to work unchanged.
"""

from .alerts import FleetAlertResponse
from .api_models import (
    BBox,
    DepthResponse,
    DescribeResponse,
    DetectedObjectResponse,
    DetectResponse,
    ErrorResponse,
    ImageInfoResponse,
    ModelInfo,
    UsageResponse,
)
from .deployment import (
    DeploymentCreateRequest,
    DeploymentDeviceStatusResponse,
    DeploymentResponse,
    RolloutStage,
)
from .device import (
    DeviceRegisterRequest,
    DeviceResponse,
    DeviceUpdateRequest,
    HardwareSpecs,
    ResourceUsage,
)
from .enums import (
    AlertSeverity,
    AlertType,
    CommandStatus,
    CommandType,
    DeploymentStatus,
    DeploymentStrategy,
    DeviceStatus,
    DeviceType,
)
from .groups import (
    AutoScalingPolicy,
    DeviceGroupCreateRequest,
    DeviceGroupResponse,
)
from .heartbeat import (
    HeartbeatRequest,
    HeartbeatResponse,
    PendingCommand,
)
from .maintenance import (
    MaintenanceWindowCreateRequest,
    MaintenanceWindowResponse,
)
from .operations import (
    BatchDeviceRequest,
    DecommissionRequest,
    OTAUpdateRequest,
)

__all__ = [
    # enums
    "AlertSeverity",
    "AlertType",
    "CommandStatus",
    "CommandType",
    "DeploymentStatus",
    "DeploymentStrategy",
    "DeviceStatus",
    "DeviceType",
    # device
    "HardwareSpecs",
    "ResourceUsage",
    "DeviceRegisterRequest",
    "DeviceResponse",
    "DeviceUpdateRequest",
    # heartbeat
    "HeartbeatRequest",
    "PendingCommand",
    "HeartbeatResponse",
    # deployment
    "RolloutStage",
    "DeploymentCreateRequest",
    "DeploymentResponse",
    "DeploymentDeviceStatusResponse",
    # groups
    "AutoScalingPolicy",
    "DeviceGroupCreateRequest",
    "DeviceGroupResponse",
    # maintenance
    "MaintenanceWindowCreateRequest",
    "MaintenanceWindowResponse",
    # operations
    "OTAUpdateRequest",
    "DecommissionRequest",
    "BatchDeviceRequest",
    # alerts
    "FleetAlertResponse",
    # api_models
    "BBox",
    "DetectedObjectResponse",
    "ImageInfoResponse",
    "DetectResponse",
    "DepthResponse",
    "DescribeResponse",
    "ModelInfo",
    "UsageResponse",
    "ErrorResponse",
]
