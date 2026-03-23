"""Model format export for edge deployment (story 190).

Export models to ONNX, TensorRT, or CoreML format.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

from openeye_ai.config import MODELS_DIR, OPENEYE_HOME

from .export_coreml import export_to_coreml
from .export_onnx import export_to_onnx
from .export_tensorrt import export_to_tensorrt
from .export_utils import _detect_source_format, _find_model_file
from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import ExportFormat, ExportRequest, ExportResult

_EXPORTS_PATH = OPENEYE_HOME / "model_exports.yaml"


def _load_exports() -> list[dict]:
    return safe_load_yaml_list(_EXPORTS_PATH)


def _save_exports(exports: list[dict]) -> None:
    atomic_save_yaml(_EXPORTS_PATH, exports)


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
            model_key=request.model_key,
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
            model_key=request.model_key,
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


def list_exports(model_key: Optional[str] = None) -> list[ExportResult]:
    """List model exports."""
    exports = _load_exports()
    result = [ExportResult(**e) for e in exports]
    if model_key:
        result = [r for r in result if r.model_key == model_key]
    return result
