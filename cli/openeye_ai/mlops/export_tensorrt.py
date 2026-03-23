"""TensorRT export conversion."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from .export_onnx import export_to_onnx


def export_to_tensorrt(
    model_path: Path,
    output_path: Path,
    *,
    input_shape: Optional[list[int]] = None,
    fp16: bool = True,
) -> Path:
    """Export an ONNX model to TensorRT engine."""
    import tensorrt as trt

    shape = input_shape or [1, 3, 640, 640]

    # If source is not ONNX, convert first
    if model_path.suffix.lower() != ".onnx":
        onnx_path = output_path.with_suffix(".onnx")
        export_to_onnx(model_path, onnx_path, input_shape=shape)
        model_path = onnx_path

    logger = trt.Logger(trt.Logger.WARNING)
    builder = trt.Builder(logger)
    network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    parser = trt.OnnxParser(network, logger)

    with open(model_path, "rb") as f:
        if not parser.parse(f.read()):
            errors = [parser.get_error(i) for i in range(parser.num_errors)]
            raise RuntimeError(f"ONNX parse failed: {errors}")

    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 1 << 30)  # 1 GB

    if fp16:
        config.set_flag(trt.BuilderFlag.FP16)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    engine = builder.build_serialized_network(network, config)
    if engine is None:
        raise RuntimeError("TensorRT engine build failed")

    with open(output_path, "wb") as f:
        f.write(engine)

    return output_path
