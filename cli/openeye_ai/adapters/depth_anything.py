"""Depth Anything V2 adapter — monocular depth estimation via transformers."""

from __future__ import annotations

import base64
import io
import time
from pathlib import Path
from typing import Any

from PIL import Image

from openeye_ai.adapters.base import ModelAdapter

HF_REPO = "depth-anything/Depth-Anything-V2-Small-hf"


class Adapter(ModelAdapter):
    def __init__(self) -> None:
        self._pipe = None

    def pull(self, model_dir: Path) -> None:
        from openeye_ai.utils.download import download_from_hf

        download_from_hf(HF_REPO, model_dir)

    def _do_load(self, model_dir: Path) -> None:
        from transformers import pipeline

        self._pipe = pipeline("depth-estimation", model=str(model_dir), device="cpu")

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        import numpy as np

        start = time.perf_counter()
        result = self._pipe(image)
        elapsed = (time.perf_counter() - start) * 1000

        depth = result["depth"]  # PIL Image
        # Normalize to 0-255 grayscale PNG
        depth_arr = np.array(depth, dtype=np.float32)
        dmin, dmax = depth_arr.min(), depth_arr.max()
        if dmax - dmin < 1e-8:
            # Flat depth — return uniform gray
            depth_img = Image.fromarray(
                (128 * np.ones_like(depth_arr)).astype(np.uint8)
            )
        else:
            depth_norm = (depth_arr - dmin) / (dmax - dmin)
            depth_img = Image.fromarray((depth_norm * 255).astype(np.uint8))

        buf = io.BytesIO()
        depth_img.save(buf, format="PNG")
        depth_b64 = base64.b64encode(buf.getvalue()).decode()

        return {
            "objects": [],
            "depth_map": depth_b64,
            "inference_ms": round(elapsed, 2),
        }
