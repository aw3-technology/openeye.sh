"""YOLOv8 adapter — object detection via ultralytics."""

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
        """ultralytics downloads weights on first use; we trigger that here."""
        from ultralytics import YOLO

        model_dir.mkdir(parents=True, exist_ok=True)
        model_path = model_dir / "yolov8n.pt"
        # Download by instantiating — ultralytics handles caching
        model = YOLO("yolov8n.pt")
        # Copy weights into our model dir
        import shutil

        src = Path(model.ckpt_path)
        if src != model_path:
            shutil.copy2(src, model_path)

    def _do_load(self, model_dir: Path) -> None:
        from ultralytics import YOLO

        model_path = model_dir / "yolov8n.pt"
        if not model_path.exists():
            raise FileNotFoundError(f"Weights not found at {model_path}. Re-run: openeye pull yolov8")
        self._model = YOLO(str(model_path))

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        start = time.perf_counter()
        results = self._model(image, verbose=False)
        elapsed = (time.perf_counter() - start) * 1000

        w_img, h_img = image.size
        objects = []
        for r in results:
            boxes = r.boxes
            for i in range(len(boxes)):
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                conf = float(boxes.conf[i])
                cls_id = int(boxes.cls[i])
                label = r.names[cls_id]
                objects.append({
                    "label": label,
                    "confidence": round(conf, 4),
                    "bbox": {
                        "x": round(x1 / w_img, 4),
                        "y": round(y1 / h_img, 4),
                        "w": round((x2 - x1) / w_img, 4),
                        "h": round((y2 - y1) / h_img, 4),
                    },
                })

        return {
            "objects": objects,
            "depth_map": None,
            "inference_ms": round(elapsed, 2),
        }
