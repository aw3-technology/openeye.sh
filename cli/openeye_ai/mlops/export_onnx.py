"""ONNX export conversion."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from .export_utils import _load_model_from_safetensors


def export_to_onnx(
    model_path: Path,
    output_path: Path,
    *,
    opset_version: int = 17,
    input_shape: Optional[list[int]] = None,
    quantize: bool = False,
    model_key: Optional[str] = None,
) -> Path:
    """Export a PyTorch/SafeTensors model to ONNX format."""
    import torch

    shape = input_shape or [1, 3, 640, 640]

    # Load model
    if model_path.suffix == ".safetensors":
        model = _load_model_from_safetensors(model_path, model_key)
    else:
        if model_path.suffix in (".pt", ".pth"):
            try:
                model = torch.jit.load(str(model_path))
            except Exception:
                model = torch.load(str(model_path), weights_only=False)
        else:
            model = torch.load(str(model_path), weights_only=True)

    if hasattr(model, "eval"):
        model.eval()

    dummy_input = torch.randn(*shape)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
        opset_version=opset_version,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}},
    )

    if quantize:
        from onnxruntime.quantization import quantize_dynamic, QuantType

        quantized_path = output_path.with_stem(output_path.stem + "_int8")
        quantize_dynamic(str(output_path), str(quantized_path), weight_type=QuantType.QUInt8)
        return quantized_path

    return output_path
