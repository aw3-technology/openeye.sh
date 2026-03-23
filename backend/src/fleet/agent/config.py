"""Device agent configuration."""

from dataclasses import dataclass, field


@dataclass
class AgentConfig:
    device_id: str = ""
    api_key: str = ""
    server_url: str = "https://localhost:8001"
    heartbeat_interval: float = 15.0  # seconds
    model_cache_dir: str = "/tmp/openeye/models"
    firmware_dir: str = "/tmp/openeye/firmware"
    max_cache_versions: int = 2  # current + previous for instant rollback
    bandwidth_limit_mbps: float = 0  # 0 = unlimited
    log_level: str = "INFO"
