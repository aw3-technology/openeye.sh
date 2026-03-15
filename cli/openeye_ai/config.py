"""Paths and constants for OpenEye AI."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

OPENEYE_HOME = Path.home() / ".openeye"
MODELS_DIR = OPENEYE_HOME / "models"
REGISTRY_FILENAME = "models.yaml"
CONFIG_PATH = OPENEYE_HOME / "config.yaml"

def ensure_dirs() -> None:
    """Create ~/.openeye/models/ if it doesn't exist."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

def load_config() -> dict[str, Any]:
    """Load config from ~/.openeye/config.yaml, returning empty dict if missing."""
    if not CONFIG_PATH.exists():
        return {}
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as exc:
        import sys
        print(f"Warning: Failed to parse {CONFIG_PATH}: {exc}", file=sys.stderr)
        return {}
    if not isinstance(data, dict):
        return {}
    return data

def save_config(cfg: dict[str, Any]) -> None:
    """Write config dict to ~/.openeye/config.yaml."""
    ensure_dirs()
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(cfg, f, default_flow_style=False)

def get_config_value(key: str) -> Any | None:
    """Get a single config value by key."""
    cfg = load_config()
    return cfg.get(key)

def set_config_value(key: str, value: Any) -> None:
    """Set a single config value and persist."""
    cfg = load_config()
    cfg[key] = value
    save_config(cfg)
