"""REST routes for Viziera VLM integration.

Extracted from rest.py — provides the ``POST /vlm/analyze`` endpoint that lets
Viziera's testing engine send screenshots for structured visual analysis
without needing a WebSocket connection.
"""

from __future__ import annotations

import io
import logging
import time
from typing import Optional

from fastapi import APIRouter, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from openeye_ai.server.state import get_state, nebius_stats

logger = logging.getLogger(__name__)

_MAX_UPLOAD_BYTES = 20 * 1024 * 1024

router = APIRouter()


def _encode_image_b64(img: Image.Image) -> str:
    """Encode a PIL image as a base64 JPEG string."""
    import base64

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def _extract_json(content: str) -> dict | None:
    """Try to extract a JSON object from VLM response text."""
    import json as _json

    json_start = content.find("{")
    json_end = content.rfind("}") + 1
    if json_start >= 0 and json_end > json_start:
        try:
            return _json.loads(content[json_start:json_end])
        except _json.JSONDecodeError:
            pass
    return None


_DEFAULT_PROMPT = (
    "Analyze this web page screenshot for visual bugs. Check for:\n"
    "1. Layout shifts or overlapping elements\n"
    "2. Text truncation or overflow\n"
    "3. Broken images\n"
    "4. Responsive issues (overflow)\n"
    "5. Contrast issues\n"
    "6. Missing content (stuck spinners, blank areas)\n"
    "7. Misaligned elements\n\n"
    'Return JSON: {"bugs": [{"type": "string", "description": "string", '
    '"severity": "high|medium|low", "region": {"x":0,"y":0,"width":0,"height":0}}]}\n'
    'If no bugs found, return: {"bugs": []}'
)


@router.post("/vlm/analyze")
async def vlm_analyze(
    request: Request,
    file: UploadFile,
    prompt: Optional[str] = Query(
        None,
        description="Custom analysis prompt. If omitted, performs general visual bug detection.",
    ),
):
    """Run VLM analysis on an uploaded image and return structured JSON."""
    import asyncio

    from openeye_ai.vlm import create_async_vlm_client

    state = get_state(request)
    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        return JSONResponse({"error": "File too large."}, status_code=413)

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        return JSONResponse({"error": "Cannot decode image."}, status_code=400)

    nebius_key, nebius_base, nebius_model = state.resolve_vlm_model()
    vlm_client, _ = create_async_vlm_client(nebius_key, nebius_base, nebius_model)
    if not vlm_client:
        return JSONResponse(
            {"error": "VLM not configured. Set NEBIUS_API_KEY or OPENROUTER_API_KEY."},
            status_code=503,
        )

    img_b64 = _encode_image_b64(img)

    t0 = time.time()
    try:
        resp = await asyncio.wait_for(
            vlm_client.chat.completions.create(
                model=nebius_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"},
                            },
                            {"type": "text", "text": prompt or _DEFAULT_PROMPT},
                        ],
                    },
                ],
                max_tokens=1024,
            ),
            timeout=30.0,
        )
        latency_ms = (time.time() - t0) * 1000
        content = resp.choices[0].message.content or ""

        nebius_stats["total_calls"] += 1
        nebius_stats["total_latency_ms"] += latency_ms
        nebius_stats["avg_latency_ms"] = nebius_stats["total_latency_ms"] / nebius_stats["total_calls"]
        nebius_stats["last_call_at"] = time.time()

        result: dict = {"raw": content, "inference_ms": round(latency_ms, 1)}
        parsed = _extract_json(content)
        if parsed:
            result.update(parsed)

        return JSONResponse(result)

    except asyncio.TimeoutError:
        nebius_stats["errors"] += 1
        return JSONResponse(
            {"error": "VLM analysis timed out after 30s."},
            status_code=504,
        )
    except Exception as e:
        nebius_stats["errors"] += 1
        logger.error("VLM analyze failed: %s", e)
        return JSONResponse(
            {"error": f"VLM analysis failed: {e}"},
            status_code=500,
        )
