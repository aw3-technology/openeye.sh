"""SAM2 adapter — zero-shot segmentation via Segment Anything 2."""

from __future__ import annotations

import base64
import io
import time
from pathlib import Path
from typing import Any

from PIL import Image

from openeye_ai.adapters.base import ModelAdapter


class Adapter(ModelAdapter):
    def __init__(self) -> None:
        self._predictor = None

    def pull(self, model_dir: Path) -> None:
        """Download SAM2 weights from HuggingFace."""
        from huggingface_hub import snapshot_download

        model_dir.mkdir(parents=True, exist_ok=True)
        snapshot_download(
            repo_id="facebook/sam2-hiera-small",
            local_dir=str(model_dir),
        )

    def _do_load(self, model_dir: Path) -> None:
        from sam2.build_sam import build_sam2
        from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator

        checkpoint = model_dir / "sam2_hiera_small.pt"
        if not checkpoint.exists():
            # Try safetensors format
            candidates = list(model_dir.glob("*.pt")) + list(
                model_dir.glob("*.safetensors")
            )
            if not candidates:
                raise FileNotFoundError(
                    f"No SAM2 weights found in {model_dir}. Re-run: openeye pull sam2"
                )
            checkpoint = candidates[0]

        model = build_sam2("sam2_hiera_s.yaml", str(checkpoint))
        self._predictor = SAM2AutomaticMaskGenerator(model)

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        import numpy as np

        start = time.perf_counter()

        img_array = np.array(image)
        masks = self._predictor.generate(img_array)
        elapsed = (time.perf_counter() - start) * 1000

        segmentation_masks = []
        for mask_data in masks:
            mask = mask_data["segmentation"]
            # Convert boolean mask to PNG
            mask_img = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
            buf = io.BytesIO()
            mask_img.save(buf, format="PNG")
            mask_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            segmentation_masks.append(
                {
                    "mask": mask_b64,
                    "area": int(mask_data["area"]),
                    "bbox": {
                        "x": round(mask_data["bbox"][0] / image.width, 4),
                        "y": round(mask_data["bbox"][1] / image.height, 4),
                        "w": round(mask_data["bbox"][2] / image.width, 4),
                        "h": round(mask_data["bbox"][3] / image.height, 4),
                    },
                    "stability_score": round(float(mask_data["stability_score"]), 4),
                }
            )

        return {
            "objects": [],
            "depth_map": None,
            "segmentation_masks": segmentation_masks,
            "inference_ms": round(elapsed, 2),
        }
