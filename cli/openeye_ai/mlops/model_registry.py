"""Enterprise model registry with versioning (stories 181-182).

Supports uploading custom models (ONNX, TorchScript, SafeTensors) and
tracking versions with metadata: training dataset, metrics, author, changelog.
"""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path
from typing import Any, Optional

import logging

from openeye_ai.config import MODELS_DIR, OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml
from .schemas import (
    ModelFormat,
    ModelRegistryEntry,
    ModelStage,
    ModelUploadRequest,
    ModelVersion,
    TrainingMetrics,
)

logger = logging.getLogger(__name__)

_ENTERPRISE_REGISTRY_PATH = OPENEYE_HOME / "registry.yaml"


def _load_enterprise_registry() -> dict[str, Any]:
    """Load the enterprise registry YAML with error recovery."""
    data = safe_load_yaml(
        _ENTERPRISE_REGISTRY_PATH,
        default=lambda: {"schema_version": 3, "models": {}},
    )
    if not isinstance(data, dict):
        data = {"schema_version": 3, "models": {}}
    if "models" not in data:
        data["models"] = {}
    return data


def _save_enterprise_registry(data: dict[str, Any]) -> None:
    """Persist the enterprise registry atomically."""
    atomic_save_yaml(_ENTERPRISE_REGISTRY_PATH, data)


def _compute_checksum(file_path: Path) -> str:
    """Compute SHA-256 checksum of a file."""
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha.update(chunk)
    return sha.hexdigest()


def list_registered_models() -> list[ModelRegistryEntry]:
    """List all models in the enterprise registry.

    Skips entries that fail validation rather than crashing the entire listing.
    """
    from pydantic import ValidationError

    data = _load_enterprise_registry()
    entries = []
    for key, raw in data["models"].items():
        try:
            entry = ModelRegistryEntry(key=key, **raw)
            entries.append(entry)
        except (ValidationError, TypeError) as e:
            logger.warning("Skipping corrupt registry entry '%s': %s", key, e)
    return entries


def get_registered_model(key: str) -> ModelRegistryEntry:
    """Get a single model from the enterprise registry."""
    data = _load_enterprise_registry()
    if key not in data["models"]:
        available = ", ".join(data["models"].keys()) or "none"
        raise KeyError(f"Model '{key}' not in enterprise registry. Available: {available}")
    raw = data["models"][key]
    return ModelRegistryEntry(key=key, **raw)


def upload_and_register(request: ModelUploadRequest) -> ModelVersion:
    """Upload a custom model file and register it (story 181).

    Copies the model file to ~/.openeye/models/{key}/ and creates a
    registry entry with version 1.0.0.
    """
    import re
    if not re.match(r"^[a-zA-Z0-9_.-]+$", request.key):
        raise ValueError(f"Invalid model key: {request.key!r} — must be alphanumeric with dashes/underscores only")
    src = Path(request.file_path)
    if not src.exists():
        raise FileNotFoundError(f"Model file not found: {src}")

    _VALID_EXTENSIONS = {
        ModelFormat.ONNX: [".onnx"],
        ModelFormat.TORCHSCRIPT: [".pt", ".pth"],
        ModelFormat.SAFETENSORS: [".safetensors"],
        ModelFormat.TENSORRT: [".engine", ".trt"],
        ModelFormat.COREML: [".mlmodel", ".mlpackage"],
        ModelFormat.PYTORCH: [".pt", ".pth", ".bin"],
    }
    valid_exts = _VALID_EXTENSIONS.get(request.format, [])
    if valid_exts and src.suffix.lower() not in valid_exts:
        raise ValueError(
            f"File extension '{src.suffix}' doesn't match format '{request.format}'. "
            f"Expected: {valid_exts}"
        )

    # Copy model file
    model_dir = MODELS_DIR / request.key
    model_dir.mkdir(parents=True, exist_ok=True)
    dest = model_dir / src.name
    shutil.copy2(src, dest)

    # Compute metadata
    file_size_mb = dest.stat().st_size / (1024 * 1024)
    checksum = _compute_checksum(dest)

    version = ModelVersion(
        version="1.0.0",
        model_key=request.key,
        format=request.format,
        file_path=str(dest),
        file_size_mb=round(file_size_mb, 2),
        checksum=checksum,
        stage=ModelStage.DEV,
        author=request.author,
    )

    # Register in enterprise registry
    data = _load_enterprise_registry()
    if request.key in data["models"]:
        raise ValueError(f"Model '{request.key}' already exists. Use add_version() instead.")

    data["models"][request.key] = {
        "name": request.name,
        "task": request.task,
        "description": request.description,
        "adapter": request.adapter,
        "tags": request.tags,
        "versions": [version.model_dump()],
    }
    _save_enterprise_registry(data)

    # Mark as pulled
    (model_dir / ".pulled").touch()

    return version


def add_version(
    model_key: str,
    *,
    file_path: str,
    version: str,
    format: ModelFormat,
    author: str = "",
    changelog: str = "",
    training_dataset: str = "",
    training_metrics: Optional[dict[str, Any]] = None,
    hyperparameters: Optional[dict[str, Any]] = None,
    code_commit: str = "",
) -> ModelVersion:
    """Add a new version to an existing model (story 182).

    Tracks version metadata: training dataset, metrics, author, changelog.
    """
    data = _load_enterprise_registry()
    if model_key not in data["models"]:
        raise KeyError(f"Model '{model_key}' not found in enterprise registry.")

    src = Path(file_path)
    if not src.exists():
        raise FileNotFoundError(f"Model file not found: {src}")

    # Copy to versioned directory
    model_dir = MODELS_DIR / model_key / f"v{version}"
    model_dir.mkdir(parents=True, exist_ok=True)
    dest = model_dir / src.name
    shutil.copy2(src, dest)

    file_size_mb = dest.stat().st_size / (1024 * 1024)
    checksum = _compute_checksum(dest)

    metrics = TrainingMetrics(**(training_metrics or {}))

    new_version = ModelVersion(
        version=version,
        model_key=model_key,
        format=format,
        file_path=str(dest),
        file_size_mb=round(file_size_mb, 2),
        checksum=checksum,
        stage=ModelStage.DEV,
        author=author,
        changelog=changelog,
        training_dataset=training_dataset,
        training_metrics=metrics,
        hyperparameters=hyperparameters or {},
        code_commit=code_commit,
    )

    # Check for duplicate version
    existing_versions = data["models"][model_key].get("versions", [])
    for v in existing_versions:
        if v["version"] == version:
            raise ValueError(f"Version '{version}' already exists for model '{model_key}'.")

    existing_versions.append(new_version.model_dump())
    data["models"][model_key]["versions"] = existing_versions
    _save_enterprise_registry(data)

    return new_version


def get_version(model_key: str, version: str) -> ModelVersion:
    """Get a specific version of a model."""
    entry = get_registered_model(model_key)
    for v in entry.versions:
        if v.version == version:
            return v
    available = [v.version for v in entry.versions]
    raise KeyError(f"Version '{version}' not found. Available: {available}")


def list_versions(model_key: str) -> list[ModelVersion]:
    """List all versions of a model."""
    entry = get_registered_model(model_key)
    return entry.versions
