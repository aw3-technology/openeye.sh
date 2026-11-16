"""Model registry — loads models.yaml and resolves adapters."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openeye_ai.config import MODELS_DIR, OPENEYE_HOME

# Built-in models ship read-only inside the package; models added with
# add-model / register-adapter / update-registry go to the user registry,
# which survives upgrades and works on read-only installs.
_REGISTRY_PATH = Path(__file__).parent / "models.yaml"
USER_REGISTRY_PATH = OPENEYE_HOME / "custom_models.yaml"
_ADAPTER_MAP: dict[str, str] = {
    "yolov8": "openeye_ai.adapters.yolov8",
    "yolo26": "openeye_ai.adapters.yolo26",
    "depth_anything": "openeye_ai.adapters.depth_anything",
    "grounding_dino": "openeye_ai.adapters.grounding_dino",
    "sam2": "openeye_ai.adapters.sam2",
    "rfdetr": "openeye_ai.adapters.rfdetr",
    "smolvla": "openeye_ai.adapters.smolvla",
    "yolov8:onnx": "openeye_ai.adapters.yolov8_onnx",
    "onnx_generic": "openeye_ai.adapters.onnx_runtime",
    "yolov8:tensorrt": "openeye_ai.adapters.tensorrt_runtime",
    "tensorrt_generic": "openeye_ai.adapters.tensorrt_runtime",
}


def _read_yaml(path: Path) -> dict[str, Any]:
    try:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as exc:
        raise ValueError(f"Failed to parse {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(
            f"Invalid registry file {path}: expected YAML dict, got {type(data).__name__}"
        )
    return data


def load_user_registry() -> dict[str, Any]:
    """Load the user registry (empty if it doesn't exist yet)."""
    if not USER_REGISTRY_PATH.exists():
        return {"models": {}}
    data = _read_yaml(USER_REGISTRY_PATH)
    if not isinstance(data.get("models"), dict):
        data["models"] = {}
    return data


def save_user_registry(data: dict[str, Any]) -> None:
    from openeye_ai.mlops.persistence import atomic_save_yaml

    atomic_save_yaml(USER_REGISTRY_PATH, data)


def _load_raw() -> dict[str, Any]:
    """Load the built-in registry with user-added models merged on top."""
    data = _read_yaml(_REGISTRY_PATH)
    models = dict(data.get("models") or {})
    models.update(load_user_registry()["models"])
    data["models"] = models
    return data


def load_registry() -> dict[str, dict[str, Any]]:
    """Return the full model registry dict."""
    data = _load_raw()
    models = data.get("models")
    if not isinstance(models, dict):
        return {}
    return models


def get_model_info(name: str) -> dict[str, Any]:
    """Get info for a single model, raise KeyError if not found."""
    registry = load_registry()
    if name not in registry:
        available = ", ".join(registry.keys())
        raise KeyError(f"Unknown model '{name}'. Available: {available}")
    return registry[name]


def is_downloaded(name: str) -> bool:
    """Check whether a model's weights exist locally."""
    model_dir = MODELS_DIR / name
    marker = model_dir / ".pulled"
    return marker.exists()


def get_variant_info(name: str, variant: str) -> dict[str, Any]:
    """Get info for a model variant, inheriting parent fields.

    Returns a merged dict with the variant's overrides applied on top of the parent model info.
    """
    info = get_model_info(name)
    variants = info.get("variants") or {}
    if variant not in variants:
        available = ", ".join(variants.keys()) if variants else "none"
        raise KeyError(
            f"Unknown variant '{variant}' for model '{name}'. Available: {available}"
        )

    # Start with parent fields, overlay variant-specific fields
    merged = dict(info)
    merged.pop("variants", None)
    # A variant with its own file must not inherit the parent file's checksum.
    if "filename" in variants[variant] and "checksum" not in variants[variant]:
        merged.pop("checksum", None)
    merged.update(variants[variant])
    merged["_variant"] = variant
    return merged


def is_variant_downloaded(name: str, variant: str) -> bool:
    """Check whether a specific variant is downloaded."""
    variant_dir = MODELS_DIR / name / f".variant-{variant}"
    marker = variant_dir / ".pulled"
    return marker.exists()


def get_adapter(name: str, *, variant: str | None = None):
    """Lazy-import and return an adapter instance for the given model name.

    If variant is specified, uses the variant's adapter if it differs from the base model's.
    If the adapter field contains '/' or ends with '.py', loads it as a custom adapter.
    """
    import importlib

    if variant:
        info = get_variant_info(name, variant)
    else:
        info = get_model_info(name)

    adapter_key = info["adapter"]

    # Custom adapter: file path
    if "/" in adapter_key or adapter_key.endswith(".py"):
        from openeye_ai.utils.custom_adapter import load_custom_adapter

        resolved = Path(adapter_key).resolve()
        if not resolved.is_file():
            raise FileNotFoundError(f"Custom adapter not found: {adapter_key}")
        # Prevent path traversal outside of cwd or home
        cwd = Path.cwd().resolve()
        home = Path.home().resolve()
        if not (
            str(resolved).startswith(str(cwd)) or str(resolved).startswith(str(home))
        ):
            raise ValueError(
                f"Custom adapter path '{adapter_key}' resolves outside the current directory and home. "
                "This is not allowed for security reasons."
            )
        return load_custom_adapter(str(resolved))

    module_path = _ADAPTER_MAP.get(adapter_key)
    if module_path is None:
        raise KeyError(
            f"No adapter registered for '{adapter_key}' (model '{name}'). "
            f"Known adapters: {', '.join(_ADAPTER_MAP.keys())}"
        )
    mod = importlib.import_module(module_path)
    return mod.Adapter()


def add_model_to_registry(key: str, entry: dict[str, Any]) -> None:
    """Validate and add a new model to the registry YAML file.

    Raises ValidationError if the entry is invalid.
    Raises ValueError if the key already exists.
    """
    from openeye_ai.utils.validation import validate_model_entry

    if not key or not key.strip():
        raise ValueError("Model key cannot be empty")

    # User-added models (via add-model / register-adapter) should not require
    # hf_repo / filename / size_mb — those are only relevant for built-in entries.
    validate_model_entry(entry, allow_custom_adapter=True)

    if key in load_registry():
        raise ValueError(f"Model '{key}' already exists in registry")

    user = load_user_registry()
    user["models"][key] = entry
    save_user_registry(user)
