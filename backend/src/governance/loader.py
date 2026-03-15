"""YAML config loader and validator for governance policies."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from pydantic import ValidationError

from governance.models import GovernanceConfig

logger = logging.getLogger(__name__)

PRESETS_DIR = Path(__file__).parent / "presets"


def load_yaml(path: str | Path) -> GovernanceConfig:
    """Load and validate a governance YAML config file."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Governance config not found: {path}")

    with open(path, encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    if raw is None:
        raise ValueError(f"Empty governance config: {path}")

    return GovernanceConfig.model_validate(raw)


def load_preset(name: str) -> GovernanceConfig:
    """Load a built-in preset by name (without .yaml extension)."""
    path = PRESETS_DIR / f"{name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Preset not found: {name} (looked in {PRESETS_DIR})")
    return load_yaml(path)


def list_presets() -> list[str]:
    """Return names of available built-in presets."""
    if not PRESETS_DIR.exists():
        return []
    return sorted(p.stem for p in PRESETS_DIR.glob("*.yaml"))


def validate_yaml(path: str | Path) -> tuple[bool, str]:
    """Validate a governance YAML file. Returns (valid, message)."""
    try:
        load_yaml(path)
        return True, "Valid governance configuration."
    except FileNotFoundError as e:
        return False, str(e)
    except yaml.YAMLError as e:
        return False, f"YAML parse error: {e}"
    except ValidationError as e:
        return False, f"Validation error: {e}"
    except ValueError as e:
        return False, str(e)


def resolve_config(config: GovernanceConfig) -> GovernanceConfig:
    """Resolve a config that extends presets — merges parent policies.

    Policies from the child config override parents with the same name.
    """
    if not config.extends:
        return config

    merged_policies = {}

    # Load parents first (in order)
    for preset_name in config.extends:
        parent = load_preset(preset_name)
        parent = resolve_config(parent)  # recursive
        for policy in parent.policies:
            merged_policies[policy.name] = policy

    # Child policies override
    for policy in config.policies:
        merged_policies[policy.name] = policy

    config.policies = list(merged_policies.values())
    config.extends = []  # already resolved
    return config
