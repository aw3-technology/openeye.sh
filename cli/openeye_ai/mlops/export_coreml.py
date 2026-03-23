"""CoreML export conversion."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from .export_utils import _load_model_from_safetensors


def export_to_coreml(
    model_path: Path,
    output_path: Path,
    *,
    input_shape: Optional[list[int]] = None,
    model_key: Optional[str] = None,
) -> Path:
    """Export a model to CoreML format for Apple devices."""
    import coremltools as ct

    shape = input_shape or [1, 3, 640, 640]

    if model_path.suffix.lower() == ".onnx":
        model = ct.convert(str(model_path))
    else:
        import torch

        if model_path.suffix == ".safetensors":
            traced = _load_model_from_safetensors(model_path, model_key)
        elif model_path.suffix in (".pt", ".pth"):
            traced = torch.jit.load(str(model_path))
        else:
            raise ValueError(f"Cannot convert {model_path.suffix} to CoreML. Use ONNX, TorchScript, or SafeTensors.")

        example_input = torch.randn(*shape)
        model = ct.convert(traced, inputs=[ct.TensorType(shape=shape)])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(output_path))
    return output_path
