"""Stateless inference service with lazy-loaded model singletons.

Provides detect(), depth(), and describe() methods for the hosted API.
Models are loaded on first use and cached in module-level singletons.
"""

import base64
import io
import logging
import threading
import time
from typing import Any

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Lazy model singletons
_yolo_model = None
_depth_model = None
_yolo_lock = threading.Lock()
_depth_lock = threading.Lock()


def _get_yolo():
    """Lazy-load YOLOv8 model (thread-safe)."""
    global _yolo_model
    if _yolo_model is None:
        with _yolo_lock:
            if _yolo_model is None:
                from ultralytics import YOLO

                logger.info("Loading YOLOv8 model...")
                _yolo_model = YOLO("yolov8n.pt")
                logger.info("YOLOv8 model loaded")
    return _yolo_model


def _get_depth():
    """Lazy-load Depth Anything V2 model (thread-safe)."""
    global _depth_model
    if _depth_model is None:
        with _depth_lock:
            if _depth_model is None:
                import torch
                from torchvision.transforms import Compose, Normalize, Resize, ToTensor

                logger.info("Loading Depth Anything V2 model...")
                _depth_model = {
                    "transform": Compose([
                        Resize((518, 518)),
                        ToTensor(),
                        Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
                    ]),
                    "device": "cuda" if torch.cuda.is_available() else "cpu",
                }
                # Attempt to load the actual model; fall back to a simple depth estimation
                try:
                    model = torch.hub.load(
                        "huggingface/pytorch-image-models",
                        "depth_anything_v2_vits",
                        pretrained=True,
                    )
                    model.eval()
                    _depth_model["model"] = model
                except Exception:
                    logger.warning("Depth Anything V2 not available; using gradient fallback")
                    _depth_model["model"] = None
                logger.info("Depth model loaded")
    return _depth_model


class InferenceService:
    """Run inference for hosted API endpoints."""

    async def detect(
        self,
        image: Image.Image,
        confidence: float = 0.25,
    ) -> dict[str, Any]:
        """Run YOLOv8 object detection. Returns objects list + timing."""
        start = time.perf_counter()
        model = _get_yolo()
        results = model(image, conf=confidence, verbose=False)
        elapsed_ms = (time.perf_counter() - start) * 1000

        objects = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxyn[0].tolist()
                objects.append(
                    {
                        "label": result.names[int(box.cls[0])],
                        "confidence": round(float(box.conf[0]), 4),
                        "bbox": {
                            "x": round(x1, 4),
                            "y": round(y1, 4),
                            "w": round(x2 - x1, 4),
                            "h": round(y2 - y1, 4),
                        },
                    }
                )

        return {
            "model": "yolov8",
            "objects": objects,
            "image": {
                "width": image.width,
                "height": image.height,
            },
            "inference_ms": round(elapsed_ms, 2),
        }

    async def depth(self, image: Image.Image) -> dict[str, Any]:
        """Run depth estimation. Returns base64-encoded depth map + timing.

        Raises RuntimeError if the real model is unavailable (prevents
        charging credits for a gradient-only fallback result).
        """
        start = time.perf_counter()
        depth_info = _get_depth()

        if depth_info["model"] is not None:
            import torch

            transform = depth_info["transform"]
            device = depth_info["device"]
            model = depth_info["model"]

            img_tensor = transform(image.convert("RGB")).unsqueeze(0).to(device)
            with torch.no_grad():
                depth_map = model(img_tensor)
            depth_np = depth_map.squeeze().cpu().numpy()
        else:
            raise RuntimeError(
                "Depth Anything V2 model is not available. "
                "Cannot produce a real depth map."
            )

        # Normalize to 0-255 and encode as PNG
        depth_norm = (
            (depth_np - depth_np.min())
            / (depth_np.max() - depth_np.min() + 1e-8)
            * 255
        ).astype(np.uint8)
        depth_img = Image.fromarray(depth_norm)
        buf = io.BytesIO()
        depth_img.save(buf, format="PNG")
        depth_b64 = base64.b64encode(buf.getvalue()).decode()

        elapsed_ms = (time.perf_counter() - start) * 1000

        return {
            "model": "depth-anything-v2",
            "depth_map": depth_b64,
            "image": {
                "width": image.width,
                "height": image.height,
            },
            "inference_ms": round(elapsed_ms, 2),
        }

    _openai_client = None

    @classmethod
    def _get_openai_client(cls):
        if cls._openai_client is None:
            import openai
            cls._openai_client = openai.AsyncOpenAI()
        return cls._openai_client

    async def describe(
        self,
        image: Image.Image,
        prompt: str = "Describe what you see in this image.",
    ) -> dict[str, Any]:
        """Run scene description using OpenAI vision model. Returns text + timing."""
        start = time.perf_counter()

        # Encode image as base64 for the vision API
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=85)
        img_b64 = base64.b64encode(buf.getvalue()).decode()

        client = self._get_openai_client()
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img_b64}",
                            },
                        },
                    ],
                }
            ],
            max_tokens=512,
        )

        description = response.choices[0].message.content or ""
        elapsed_ms = (time.perf_counter() - start) * 1000

        return {
            "model": "gpt-4o",
            "description": description,
            "image": {
                "width": image.width,
                "height": image.height,
            },
            "inference_ms": round(elapsed_ms, 2),
        }
