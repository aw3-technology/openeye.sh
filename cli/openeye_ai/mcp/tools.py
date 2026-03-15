"""MCP tool implementations for desktop vision."""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)

# Lazy-initialized singletons
_screen_capture = None
_vlm_client = None
_vlm_model: str = ""

def _get_screen_capture(monitor: int = 1, region: tuple[int, int, int, int] | None = None):
    """Get or create the shared ScreenCapture instance."""
    global _screen_capture
    if _screen_capture is None:
        from openeye_ai.utils.screen_capture import ScreenCapture

        _screen_capture = ScreenCapture(monitor=monitor, region=region, max_fps=0, scale=1.0)
    return _screen_capture

def _get_vlm_client():
    """Get or create the async OpenAI VLM client."""
    global _vlm_client, _vlm_model

    if _vlm_client is not None:
        return _vlm_client, _vlm_model

    _vlm_model = os.environ.get("NEBIUS_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct")
    is_openrouter = "/" in _vlm_model and (
        _vlm_model.split("/")[0].islower() or ":free" in _vlm_model
    )

    if is_openrouter:
        api_key = os.environ.get("OPENROUTER_API_KEY", "")
        base_url = "https://openrouter.ai/api/v1"
    else:
        api_key = os.environ.get("NEBIUS_API_KEY", "")
        base_url = os.environ.get(
            "NEBIUS_BASE_URL", "https://api.studio.nebius.com/v1"
        )

    if not api_key:
        logger.warning("No VLM API key configured — VLM tools will return empty results")
        return None, _vlm_model

    try:
        import openai

        _vlm_client = openai.AsyncOpenAI(base_url=base_url, api_key=api_key)
    except ImportError:
        logger.error("openai package not installed — VLM tools disabled")
        return None, _vlm_model

    return _vlm_client, _vlm_model

def _capture_frame_b64(
    monitor: int = 1, region: tuple[int, int, int, int] | None = None
) -> tuple[str, int, int]:
    """Capture screen and return (base64_jpeg, width, height)."""
    cap = _get_screen_capture(monitor, region)
    img = cap.read_pil()
    if img is None:
        raise RuntimeError("Failed to capture screen")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return b64, img.width, img.height

async def _call_vlm(system_prompt: str, user_text: str, frame_b64: str) -> dict[str, Any]:
    """Send a frame to the VLM and parse JSON response."""
    import asyncio

    client, model = _get_vlm_client()
    if client is None:
        return {"error": "VLM not configured (missing API key)"}

    t0 = time.time()
    try:
        resp = await asyncio.wait_for(
            client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{frame_b64}"
                                },
                            },
                            {"type": "text", "text": user_text},
                        ],
                    },
                ],
                max_tokens=1500,
            ),
            timeout=15.0,
        )
        latency = (time.time() - t0) * 1000
        content = resp.choices[0].message.content or ""

        # Parse JSON from response
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
            parsed["vlm_ms"] = round(latency, 1)
            return parsed
        except (json.JSONDecodeError, ValueError):
            return {
                "raw_response": content,
                "vlm_ms": round(latency, 1),
            }
    except Exception as e:
        return {
            "error": str(e),
            "vlm_ms": round((time.time() - t0) * 1000, 1),
        }

async def capture_screen(
    monitor: int = 1,
    region: tuple[int, int, int, int] | None = None,
) -> dict[str, Any]:
    """Capture a screenshot and return it as base64 image data."""
    b64, w, h = _capture_frame_b64(monitor, region)
    return {
        "image_base64": b64,
        "width": w,
        "height": h,
        "format": "jpeg",
    }

async def describe_screen(
    monitor: int = 1,
    region: tuple[int, int, int, int] | None = None,
) -> dict[str, Any]:
    """Capture screen and return full VLM desktop analysis."""
    from openeye_ai.desktop.prompts import DESKTOP_SYSTEM_PROMPT

    b64, w, h = _capture_frame_b64(monitor, region)
    result = await _call_vlm(
        DESKTOP_SYSTEM_PROMPT,
        "Analyze this desktop screenshot.",
        b64,
    )
    result["screen_width"] = w
    result["screen_height"] = h
    return result

async def find_element(
    query: str,
    monitor: int = 1,
    region: tuple[int, int, int, int] | None = None,
) -> dict[str, Any]:
    """Find a UI element by natural language description."""
    from openeye_ai.desktop.prompts import DESKTOP_FIND_ELEMENT_PROMPT

    b64, w, h = _capture_frame_b64(monitor, region)
    result = await _call_vlm(
        DESKTOP_FIND_ELEMENT_PROMPT,
        f"Find this element: {query}",
        b64,
    )
    result["query"] = query
    result["screen_width"] = w
    result["screen_height"] = h
    return result

async def read_text(
    monitor: int = 1,
    region: tuple[int, int, int, int] | None = None,
) -> dict[str, Any]:
    """Extract all readable text from the screen."""
    from openeye_ai.desktop.prompts import DESKTOP_READ_TEXT_PROMPT

    b64, w, h = _capture_frame_b64(monitor, region)
    result = await _call_vlm(
        DESKTOP_READ_TEXT_PROMPT,
        "Extract all readable text from this screenshot.",
        b64,
    )
    result["screen_width"] = w
    result["screen_height"] = h
    return result
