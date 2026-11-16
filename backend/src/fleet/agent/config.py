"""Device agent configuration."""

from dataclasses import dataclass
from pathlib import Path

# Persistent per-user cache (not /tmp, which is cleared on reboot and would
# drop the rollback copy; ~ resolves on Windows too).
_CACHE_ROOT = Path.home() / ".openeye" / "fleet"


@dataclass
class AgentConfig:
    device_id: str = ""
    api_key: str = ""
    server_url: str = (
        "http://localhost:8001"  # matches OPENEYE_FLEET_URL / make dev-backend
    )
    heartbeat_interval: float = 15.0  # seconds
    model_cache_dir: str = str(_CACHE_ROOT / "models")
    firmware_dir: str = str(_CACHE_ROOT / "firmware")
    max_cache_versions: int = 2  # current + previous for instant rollback
    bandwidth_limit_mbps: float = 0  # 0 = unlimited
    log_level: str = "INFO"
