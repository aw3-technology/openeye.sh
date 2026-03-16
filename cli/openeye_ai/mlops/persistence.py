"""Shared YAML persistence utilities with atomic writes and error recovery."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Union

import yaml

logger = logging.getLogger(__name__)

# Register a YAML representer for Python enums so safe_dump handles them.
import enum  # noqa: E402


def _enum_representer(dumper, data):
    return dumper.represent_str(data.value)


yaml.SafeDumper.add_multi_representer(enum.Enum, _enum_representer)


def safe_load_yaml(path: Path, *, default: Any = None) -> Any:
    """Load YAML with error recovery.

    Returns the default if the file doesn't exist or is corrupt.
    Logs a warning on corrupt files rather than crashing.
    """
    if not path.exists():
        return default() if callable(default) else (default if default is not None else {})

    try:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        logger.warning("Corrupt YAML file %s: %s — returning default", path, e)
        # Try to preserve the corrupt file for debugging
        backup = path.with_suffix(path.suffix + ".corrupt")
        try:
            path.rename(backup)
            logger.warning("Corrupt file backed up to %s", backup)
        except OSError:
            pass
        return default() if callable(default) else (default if default is not None else {})

    if data is None:
        return default() if callable(default) else (default if default is not None else {})
    return data


def safe_load_yaml_list(path: Path) -> list[dict]:
    """Load a YAML file that should contain a list of dicts."""
    data = safe_load_yaml(path, default=list)
    return data if isinstance(data, list) else []


def atomic_save_yaml(path: Path, data: Any) -> None:
    """Write YAML atomically using write-to-temp + rename.

    Prevents data corruption from crashes or power failures.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    # Write to temp file in the same directory (ensures same filesystem for rename)
    fd, tmp_path = tempfile.mkstemp(
        dir=str(path.parent),
        prefix=f".{path.stem}_",
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w") as f:
            yaml.safe_dump(data, f, default_flow_style=False, sort_keys=False)
        # Atomic rename (POSIX guarantees atomicity on same filesystem)
        os.replace(tmp_path, str(path))
    except Exception:
        # Clean up temp file on any failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
