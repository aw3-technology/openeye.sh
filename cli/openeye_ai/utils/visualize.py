"""Visualization utilities for drawing bounding boxes and saving depth maps."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from PIL import Image as PILImage


def draw_boxes(image: PILImage.Image, objects: list[dict]) -> PILImage.Image:
    """Draw bounding boxes and labels on an image.

    Args:
        image: PIL Image (RGB).
        objects: List of dicts with keys: label, confidence, bbox {x, y, w, h} (normalized 0-1).

    Returns:
        A copy of the image with boxes drawn.
    """
    from PIL import ImageDraw, ImageFont

    img = image.copy()
    draw = ImageDraw.Draw(img)
    img_w, img_h = img.size

    try:
        font = ImageFont.truetype("arial.ttf", size=max(12, img_h // 40))
    except OSError:
        font = ImageFont.load_default()

    colors = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#5856D6", "#AF52DE"]

    for i, obj in enumerate(objects):
        bbox = obj["bbox"]
        x1 = bbox["x"] * img_w
        y1 = bbox["y"] * img_h
        x2 = (bbox["x"] + bbox["w"]) * img_w
        y2 = (bbox["y"] + bbox["h"]) * img_h
        color = colors[i % len(colors)]

        draw.rectangle([x1, y1, x2, y2], outline=color, width=max(2, img_h // 200))

        label = f"{obj['label']} {obj['confidence']:.0%}"
        text_bbox = draw.textbbox((x1, y1), label, font=font)
        draw.rectangle([text_bbox[0] - 2, text_bbox[1] - 2, text_bbox[2] + 2, text_bbox[3] + 2], fill=color)
        draw.text((x1, y1), label, fill="white", font=font)

    return img


def save_depth_map(depth_b64: str, output_path: Path) -> None:
    """Decode a base64 depth map PNG and save it.

    Raises:
        OSError: If decoding or saving fails.
    """
    import base64
    import binascii
    import io

    from PIL import Image

    try:
        raw = base64.b64decode(depth_b64)
    except binascii.Error as e:
        raise OSError(f"Invalid base64 depth map data: {e}") from e
    img = Image.open(io.BytesIO(raw))
    img.save(output_path)
