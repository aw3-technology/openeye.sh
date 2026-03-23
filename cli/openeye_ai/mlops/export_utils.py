"""Shared helpers for model export."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from openeye_ai.config import MODELS_DIR

from .schemas import ModelFormat


def _detect_source_format(model_path: Path) -> ModelFormat:
    """Detect the model format from the file extension."""
    ext = model_path.suffix.lower()
    mapping = {
        ".onnx": ModelFormat.ONNX,
        ".pt": ModelFormat.PYTORCH,
        ".pth": ModelFormat.PYTORCH,
        ".safetensors": ModelFormat.SAFETENSORS,
        ".engine": ModelFormat.TENSORRT,
        ".trt": ModelFormat.TENSORRT,
        ".mlmodel": ModelFormat.COREML,
    }
    fmt = mapping.get(ext)
    if fmt is None:
        raise ValueError(f"Unrecognized model file extension '{ext}'. Supported: {list(mapping.keys())}")
    return fmt


def _find_model_file(model_key: str, model_version: str) -> Path:
    """Find the model file for a given key and version."""
    # Check versioned directory first
    version_dir = MODELS_DIR / model_key / f"v{model_version}"
    if version_dir.exists():
        for f in version_dir.iterdir():
            if f.is_file() and f.suffix.lower() in {
                ".onnx", ".pt", ".pth", ".safetensors", ".engine", ".bin"
            }:
                return f

    # Fall back to base model directory
    base_dir = MODELS_DIR / model_key
    if base_dir.exists():
        for f in base_dir.iterdir():
            if f.is_file() and f.suffix.lower() in {
                ".onnx", ".pt", ".pth", ".safetensors", ".engine", ".bin"
            }:
                return f

    raise FileNotFoundError(f"No model file found for {model_key} v{model_version}")


def _load_model_from_safetensors(
    model_path: Path,
    model_key: Optional[str] = None,
) -> "torch.nn.Module":
    """Load a model from a .safetensors file using companion file or adapter.

    Strategy:
      1. Look for a companion .pt/.pth TorchScript file in the same directory.
      2. If not found, load via the adapter registry using model_key.
      3. If the adapter's internal model isn't a torch.nn.Module, raise a clear error.
    """
    import torch

    # 1. Try companion TorchScript file
    parent = model_path.parent
    for ext in (".pt", ".pth"):
        candidates = list(parent.glob(f"*{ext}"))
        for candidate in candidates:
            try:
                model = torch.jit.load(str(candidate))
                return model
            except Exception:
                continue

    # 2. Fall back to adapter
    if not model_key:
        raise ValueError(
            f"Cannot export {model_path.name}: no companion .pt/.pth file found "
            "and no model_key provided. Pass --key <model> so the adapter can "
            "reconstruct the architecture."
        )

    from openeye_ai.registry import get_adapter

    adapter = get_adapter(model_key)
    adapter.load(model_path.parent)

    # Extract the underlying torch model from the adapter
    for attr in ("_model", "_model_obj", "_pipe"):
        inner = getattr(adapter, attr, None)
        if inner is not None and isinstance(inner, torch.nn.Module):
            return inner

    raise TypeError(
        f"Adapter '{model_key}' loaded successfully but its internal model "
        f"is not a torch.nn.Module (got {type(getattr(adapter, '_model', None)).__name__}). "
        "Export requires a native PyTorch model. Consider exporting via the "
        "model's own export method or converting to TorchScript first."
    )
