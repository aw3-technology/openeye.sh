"""Schema validation for model registry entries."""

from __future__ import annotations

import re
from typing import Any

VALID_TASKS = {"detection", "depth", "segmentation", "classification", "embedding", "vla"}
CHECKSUM_PATTERN = re.compile(r"^[a-fA-F0-9]{64}$")  # SHA-256
REQUIRED_FIELDS = {"name", "task", "adapter", "description"}
FULL_FIELDS = REQUIRED_FIELDS | {"hf_repo", "filename", "size_mb"}


class ValidationError(ValueError):
    """Raised when a model registry entry fails validation."""


def validate_model_entry(entry: dict[str, Any], *, allow_custom_adapter: bool = False) -> None:
    """Validate a model registry entry dict.

    Raises ValidationError on any schema violation.
    """
    required = REQUIRED_FIELDS if allow_custom_adapter else FULL_FIELDS
    missing = required - set(entry.keys())
    if missing:
        raise ValidationError(f"Missing required fields: {', '.join(sorted(missing))}")

    if entry["task"] not in VALID_TASKS:
        raise ValidationError(
            f"Invalid task '{entry['task']}'. Must be one of: {', '.join(sorted(VALID_TASKS))}"
        )

    if "size_mb" in entry:
        if not isinstance(entry["size_mb"], (int, float)) or entry["size_mb"] <= 0:
            raise ValidationError("size_mb must be a positive number")

    if "checksum" in entry:
        _validate_checksum(entry["checksum"])

    if "variants" in entry:
        for variant_name, variant in entry["variants"].items():
            if "filename" not in variant:
                raise ValidationError(f"Variant '{variant_name}' missing 'filename'")
            if "checksum" in variant:
                _validate_checksum(variant["checksum"])


def _validate_checksum(cs: dict[str, Any]) -> None:
    """Validate a checksum sub-dict."""
    if "algorithm" not in cs or "value" not in cs:
        raise ValidationError("checksum must have 'algorithm' and 'value' keys")
    if cs["algorithm"] not in ("sha256", "md5"):
        raise ValidationError(f"Unsupported checksum algorithm: {cs['algorithm']}")
    if cs["algorithm"] == "sha256" and not CHECKSUM_PATTERN.match(cs["value"]):
        raise ValidationError("Invalid SHA-256 checksum value")
