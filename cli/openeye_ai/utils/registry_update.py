"""Remote registry fetching and merging."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
import yaml
from rich import print as rprint


def fetch_remote_registry(url: str, timeout: float = 15.0) -> dict[str, Any]:
    """Fetch and parse a remote models.yaml registry."""
    resp = httpx.get(url, timeout=timeout, follow_redirects=True)
    resp.raise_for_status()
    data = yaml.safe_load(resp.text)
    if not isinstance(data, dict) or "models" not in data:
        raise ValueError("Remote registry missing 'models' key")
    return data


def merge_registries(
    local: dict[str, Any], remote: dict[str, Any]
) -> tuple[dict[str, Any], list[str]]:
    """Merge remote models into local registry without overwriting local customizations.

    Returns (merged_registry, list_of_new_model_keys).
    """
    local_models = local.get("models") or {}
    remote_models = remote.get("models") or {}
    added: list[str] = []

    for key, entry in remote_models.items():
        if key not in local_models:
            local_models[key] = entry
            added.append(key)

    local["models"] = local_models
    # Update schema_version if remote is newer
    remote_version = remote.get("schema_version", 1)
    local_version = local.get("schema_version", 1)
    if remote_version > local_version:
        local["schema_version"] = remote_version

    return local, added


def update_registry_from_remote(registry_path: Path) -> list[str]:
    """Load local registry, fetch remote, merge, and write back.

    Returns list of newly added model keys.
    """
    with open(registry_path, encoding="utf-8") as f:
        local = yaml.safe_load(f)

    url = local.get("registry_url")
    if not url:
        raise ValueError("No registry_url configured in models.yaml")

    rprint(f"[dim]Fetching registry from {url}...[/dim]")
    remote = fetch_remote_registry(url)
    merged, added = merge_registries(local, remote)

    with open(registry_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(merged, f, default_flow_style=False, sort_keys=False)

    return added
