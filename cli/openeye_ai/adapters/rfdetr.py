"""RF-DETR adapter — real-time detection transformer."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from PIL import Image

from openeye_ai.adapters.base import ModelAdapter


class Adapter(ModelAdapter):
    def __init__(self) -> None:
        self._model = None

    def pull(self, model_dir: Path) -> None:
        """RF-DETR auto-downloads weights on first use."""
        from rfdetr import RFDETRBase

        model_dir.mkdir(parents=True, exist_ok=True)
        # Trigger download
        RFDETRBase()

    def _do_load(self, model_dir: Path) -> None:
        from rfdetr import RFDETRBase

        self._model = RFDETRBase()

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        start = time.perf_counter()
        detections = self._model.predict(image)
        elapsed = (time.perf_counter() - start) * 1000

        w_img, h_img = image.size
        objects = []

        # RF-DETR returns supervision.Detections
        if hasattr(detections, "xyxy"):
            for i in range(len(detections.xyxy)):
                x1, y1, x2, y2 = detections.xyxy[i].tolist()
                conf = float(detections.confidence[i])
                cls_id = int(detections.class_id[i])
                label = str(cls_id)
                objects.append(
                    {
                        "label": label,
                        "confidence": round(conf, 4),
                        "bbox": {
                            "x": round(x1 / w_img, 4),
                            "y": round(y1 / h_img, 4),
                            "w": round((x2 - x1) / w_img, 4),
                            "h": round((y2 - y1) / h_img, 4),
                        },
                    }
                )

        return {
            "objects": objects,
            "depth_map": None,
            "inference_ms": round(elapsed, 2),
        }
