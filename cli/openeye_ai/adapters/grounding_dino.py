"""Grounding DINO adapter — open-vocabulary detection via transformers."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from PIL import Image

from openeye_ai.adapters.base import ModelAdapter

HF_REPO = "IDEA-Research/grounding-dino-tiny"


class Adapter(ModelAdapter):
    def __init__(self) -> None:
        self._processor = None
        self._model_obj = None

    def pull(self, model_dir: Path) -> None:
        from openeye_ai.utils.download import download_from_hf

        download_from_hf(HF_REPO, model_dir)

    def _do_load(self, model_dir: Path) -> None:
        from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

        self._processor = AutoProcessor.from_pretrained(str(model_dir))
        self._model_obj = AutoModelForZeroShotObjectDetection.from_pretrained(str(model_dir))

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        return self.predict_with_prompt(image, "object")

    def predict_with_prompt(self, image: Image.Image, prompt: str) -> dict[str, Any]:
        if not self._loaded:
            from openeye_ai.adapters.base import ModelNotLoadedError
            raise ModelNotLoadedError("Model not loaded. Call load() before predict_with_prompt().")

        import torch

        # Grounding DINO expects prompt ending with period
        text = prompt.strip()
        if not text.endswith("."):
            text += "."

        start = time.perf_counter()
        inputs = self._processor(images=image, text=text, return_tensors="pt")
        with torch.no_grad():
            outputs = self._model_obj(**inputs)

        target_sizes = torch.tensor([image.size[::-1]])
        results = self._processor.post_process_grounded_object_detection(
            outputs, inputs["input_ids"], threshold=0.3, target_sizes=target_sizes
        )[0]
        elapsed = (time.perf_counter() - start) * 1000

        w_img, h_img = image.size
        objects = []
        for score, label, box in zip(
            results["scores"].tolist(),
            results["text_labels"],
            results["boxes"].tolist(),
        ):
            x1, y1, x2, y2 = box
            objects.append({
                "label": label,
                "confidence": round(score, 4),
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
