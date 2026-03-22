"""Shared utilities for WebSocket route handlers."""

from __future__ import annotations

import base64
import io
import logging

from fastapi import WebSocket
from PIL import Image

from openeye_ai.server.queue import QueueFullError

logger = logging.getLogger(__name__)


async def decode_base64_image(data: str) -> tuple[Image.Image, int, int]:
    """Decode base64 string to PIL Image. Returns (img, width, height). Raises ValueError on failure."""
    try:
        img_bytes = base64.b64decode(data)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError("Invalid image data.") from exc
    w, h = img.size
    return img, w, h


async def submit_inference(queue, fn, ws: WebSocket, error_msg: str = "Server busy."):
    """Submit inference to queue, sending error on failure. Returns result or None."""
    try:
        return await queue.submit(fn)
    except QueueFullError:
        await ws.send_json({"error": error_msg})
        return None
    except Exception as e:
        logger.error("Inference failed: %s", e)
        await ws.send_json({"error": error_msg})
        return None
