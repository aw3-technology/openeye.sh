"""TensorRT adapter — accelerated inference via ONNX Runtime TensorrtExecutionProvider."""

from __future__ import annotations

from openeye_ai.adapters.onnx_runtime import ONNXAdapter


class TensorRTAdapter(ONNXAdapter):
    """Base adapter for TensorRT-accelerated models via ONNX Runtime."""

    def _get_providers(self) -> list[str]:
        """Use TensorRT provider with CUDA fallback."""
        return [
            "TensorrtExecutionProvider",
            "CUDAExecutionProvider",
            "CPUExecutionProvider",
        ]


class Adapter(TensorRTAdapter):
    """Generic TensorRT adapter — same as ONNX but with TRT providers."""
    pass
