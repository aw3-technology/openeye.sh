"""Model format export for edge deployment (story 190).

Export models to ONNX, TensorRT, or CoreML format.
"""

from __future__ import annotations

import time
from pathlib import Path

from openeye_ai.config import MODELS_DIR, OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import ExportFormat, ExportRequest, ExportResult, ModelFormat

_EXPORTS_PATH = OPENEYE_HOME / "model_exports.yaml"

def _load_exports() -> list[dict]:
    return safe_load_yaml_list(_EXPORTS_PATH)

def _save_exports(exports: list[dict]) -> None:
    atomic_save_yaml(_EXPORTS_PATH, exports)

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

def export_to_onnx(
    model_path: Path,
    output_path: Path,
    *,
    opset_version: int = 17,
    input_shape: list[int] | None = None,
    quantize: bool = False,
) -> Path:
    """Export a PyTorch/SafeTensors model to ONNX format."""
    import torch

    shape = input_shape or [1, 3, 640, 640]

    # Load model
    if model_path.suffix == ".safetensors":
        from safetensors.torch import load_file

        state_dict = load_file(str(model_path))
        # For generic export, we'd need the model architecture
        # This is a simplified path — real impl needs model class
        raise NotImplementedError(
            "SafeTensors export requires the model class. "
            "Use the model's native export method or provide a TorchScript model."
        )
    else:
        if model_path.suffix == ".pt":
            model = torch.jit.load(str(model_path))
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

def export_to_tensorrt(
    model_path: Path,
    output_path: Path,
    *,
    input_shape: list[int] | None = None,
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

def export_to_coreml(
    model_path: Path,
    output_path: Path,
    *,
    input_shape: list[int] | None = None,
) -> Path:
    """Export a model to CoreML format for Apple devices."""
    import coremltools as ct

    shape = input_shape or [1, 3, 640, 640]

    if model_path.suffix.lower() == ".onnx":
        model = ct.convert(str(model_path))
    else:
        import torch

        if model_path.suffix == ".pt":
            traced = torch.jit.load(str(model_path))
        else:
            raise ValueError(f"Cannot convert {model_path.suffix} to CoreML. Use ONNX or TorchScript.")

        example_input = torch.randn(*shape)
        model = ct.convert(traced, inputs=[ct.TensorType(shape=shape)])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(output_path))
    return output_path

def export_model(request: ExportRequest) -> ExportResult:
    """Export a model to the requested format (story 190)."""
    start = time.monotonic()

    model_path = _find_model_file(request.model_key, request.model_version)
    source_format = _detect_source_format(model_path)

    # Determine output path
    if request.output_path:
        output_path = Path(request.output_path)
    else:
        ext_map = {
            ExportFormat.ONNX: ".onnx",
            ExportFormat.TENSORRT: ".engine",
            ExportFormat.COREML: ".mlmodel",
        }
        ext = ext_map[request.target_format]
        output_path = (
            MODELS_DIR
            / request.model_key
            / f"v{request.model_version}"
            / f"model{ext}"
        )

    # Export
    if request.target_format == ExportFormat.ONNX:
        result_path = export_to_onnx(
            model_path,
            output_path,
            opset_version=request.opset_version or 17,
            input_shape=request.input_shape,
            quantize=request.quantize,
        )
    elif request.target_format == ExportFormat.TENSORRT:
        result_path = export_to_tensorrt(
            model_path,
            output_path,
            input_shape=request.input_shape,
        )
    elif request.target_format == ExportFormat.COREML:
        result_path = export_to_coreml(
            model_path,
            output_path,
            input_shape=request.input_shape,
        )
    else:
        raise ValueError(f"Unsupported export format: {request.target_format}")

    duration = time.monotonic() - start
    output_size_mb = result_path.stat().st_size / (1024 * 1024)

    result = ExportResult(
        model_key=request.model_key,
        model_version=request.model_version,
        source_format=source_format,
        target_format=request.target_format,
        output_path=str(result_path),
        output_size_mb=round(output_size_mb, 2),
        quantized=request.quantize,
        export_duration_seconds=round(duration, 2),
    )

    # Persist export record
    exports = _load_exports()
    exports.append(result.model_dump())
    _save_exports(exports)

    return result

def list_exports(model_key: str | None = None) -> list[ExportResult]:
    """List model exports."""
    exports = _load_exports()
    result = [ExportResult(**e) for e in exports]
    if model_key:
        result = [r for r in result if r.model_key == model_key]
    return result
