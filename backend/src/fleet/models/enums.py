"""Fleet & Device Management enums."""

from enum import Enum


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
