from __future__ import annotations

import io
import logging

from fastapi import Depends, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.queue import QueueFullError
from openeye_ai.server.state import get_state

from .v1_auth import _valid_api_key
from .v1_usage import _CREDITS, _get_ledger

logger = logging.getLogger(__name__)

_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


async def _read_image(file: UploadFile) -> Image.Image:
    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        raise _upload_error(f"File too large ({len(contents)} bytes). Max: {_MAX_UPLOAD_BYTES}.")
    if not contents:
        raise _upload_error("Empty file.")
    try:
        return Image.open(io.BytesIO(contents)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        raise _upload_error("Cannot decode image.")


def _upload_error(detail: str):
    from fastapi import HTTPException
    return HTTPException(status_code=400, detail=detail)


async def detect(
    request: Request,
    file: UploadFile,
    confidence: float = Query(0.25, ge=0, le=1),
    api_key: str = Depends(_valid_api_key),
):
    """Object detection via hosted API."""
    state = get_state(request)
    img = await _read_image(file)
    w, h = img.size

    def _infer():
        return state.adapter.predict(img)

    try:
        result_data = await state.inference_queue.submit(_infer)
    except QueueFullError:
        return JSONResponse({"error": "Server busy"}, status_code=503)
    except Exception as exc:
        logger.error("Inference failed: %s", exc)
        return JSONResponse({"error": "Inference failed"}, status_code=500)

    # Filter by confidence
    objects = [
        obj for obj in result_data.get("objects", [])
        if obj.get("confidence", 0) >= confidence
    ]
    result_data["objects"] = objects

    credits_used = _CREDITS.get("detect", 1)
    ledger = _get_ledger(request)
    ledger.record(api_key, state.model_name, "detect", credits_used)

    result = PredictionResult(
        model=state.model_name,
        task=state.model_info["task"],
        image=ImageInfo(width=w, height=h, source=file.filename or "upload"),
        **result_data,
    )
    resp = result.model_dump()
    resp["credits_used"] = credits_used
    return JSONResponse(resp)


async def depth(
    request: Request,
    file: UploadFile,
    api_key: str = Depends(_valid_api_key),
):
    """Depth estimation via hosted API."""
    state = get_state(request)
    img = await _read_image(file)
    w, h = img.size

    def _infer():
        return state.adapter.predict(img)

    try:
        result_data = await state.inference_queue.submit(_infer)
    except QueueFullError:
        return JSONResponse({"error": "Server busy"}, status_code=503)
    except Exception as exc:
        logger.error("Depth estimation failed: %s", exc)
        return JSONResponse({"error": "Inference failed"}, status_code=500)

    credits_used = _CREDITS.get("depth", 2)
    ledger = _get_ledger(request)
    ledger.record(api_key, state.model_name, "depth", credits_used)

    return JSONResponse({
        "width": w,
        "height": h,
        "credits_used": credits_used,
        "depth_map": result_data.get("depth_map"),
        "inference_ms": result_data.get("inference_ms", 0),
    })


async def describe(
    request: Request,
    file: UploadFile,
    prompt: str = Query("Describe what you see in this image."),
    api_key: str = Depends(_valid_api_key),
):
    """VLM scene description via hosted API."""
    state = get_state(request)
    img = await _read_image(file)

    def _infer():
        if hasattr(state.adapter, "predict_with_prompt"):
            return state.adapter.predict_with_prompt(img, prompt)
        return state.adapter.predict(img)

    try:
        result_data = await state.inference_queue.submit(_infer)
    except QueueFullError:
        return JSONResponse({"error": "Server busy"}, status_code=503)
    except Exception as exc:
        logger.error("Describe failed: %s", exc)
        return JSONResponse({"error": "Inference failed"}, status_code=500)

    credits_used = _CREDITS.get("describe", 5)
    ledger = _get_ledger(request)
    ledger.record(api_key, state.model_name, "describe", credits_used)

    description = result_data.get("description", result_data.get("text", ""))
    return JSONResponse({
        "description": description,
        "credits_used": credits_used,
        "inference_ms": result_data.get("inference_ms", 0),
    })
