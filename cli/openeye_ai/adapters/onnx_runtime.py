"""ONNX Runtime base adapter."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image

from openeye_ai.adapters.base import ModelAdapter


class ONNXAdapter(ModelAdapter):
    """Base adapter for models running via ONNX Runtime."""

    def __init__(self) -> None:
        self._session = None

    def pull(self, model_dir: Path) -> None:
        from openeye_ai.utils.download import download_from_hf

        # Default pull uses HF download; subclasses can override
        info = self._get_registry_info()
        if info:
            download_from_hf(info["hf_repo"], model_dir, info.get("filename"))

    def _get_registry_info(self) -> dict[str, Any] | None:
        """Override in subclasses to return model info for pulling."""
        return None

    def _do_load(self, model_dir: Path) -> None:
        import onnxruntime as ort

        onnx_files = list(model_dir.glob("*.onnx"))
        if not onnx_files:
            raise FileNotFoundError(f"No .onnx file found in {model_dir}")

        model_path = onnx_files[0]
        providers = self._get_providers()
        self._session = ort.InferenceSession(str(model_path), providers=providers)

    def _get_providers(self) -> list[str]:
        """Return ordered list of ONNX Runtime execution providers."""
        providers = []
        try:
            import torch

            if torch.cuda.is_available():
                providers.append("CUDAExecutionProvider")
        except ImportError:
            pass
        providers.append("CPUExecutionProvider")
        return providers

    def preprocess(self, image: Image.Image):
        """Preprocess image to numpy array. Override for model-specific preprocessing."""
        import numpy as np

        img = image.resize((640, 640))
        arr = np.array(img).astype(np.float32) / 255.0
        arr = arr.transpose(2, 0, 1)  # HWC -> CHW
        return np.expand_dims(arr, axis=0)  # add batch dim

    def postprocess(self, outputs: list, image: Image.Image) -> dict[str, Any]:
        """Postprocess ONNX outputs. Override for model-specific postprocessing."""
        return {"objects": [], "depth_map": None, "inference_ms": 0.0}

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        import time

        input_tensor = self.preprocess(image)
        input_name = self._session.get_inputs()[0].name

        start = time.perf_counter()
        outputs = self._session.run(None, {input_name: input_tensor})
        elapsed = (time.perf_counter() - start) * 1000

        result = self.postprocess(outputs, image)
        result["inference_ms"] = round(elapsed, 2)
        return result
