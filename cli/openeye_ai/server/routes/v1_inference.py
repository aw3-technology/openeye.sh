from __future__ import annotations

import io
import logging

from fastapi import Depends, Form, Query, Request, UploadFile
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
        raise _upload_error(
            f"File too large ({len(contents)} bytes). Max: {_MAX_UPLOAD_BYTES}."
        )
    if not contents:
        raise _upload_error("Empty file.")
    try:
        return Image.open(io.BytesIO(contents)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        raise _upload_error("Cannot decode image.")


def _upload_error(detail: str):
    from fastapi import HTTPException

    return HTTPException(status_code=400, detail=detail)


_DEFAULT_CONFIDENCE = 0.25
_DEFAULT_PROMPT = "Describe what you see in this image."
_MAX_PROMPT_LENGTH = 2000


def _resolve_confidence(form_value: str | None, query_value: str | None) -> float:
    """Pick ``confidence`` from the multipart form, then the query string.

    Matches the hosted API (``form.fields.confidence ?? query.confidence``).
    """
    raw = form_value if form_value not in (None, "") else query_value
    if raw in (None, ""):
        return _DEFAULT_CONFIDENCE
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise _upload_error("confidence must be between 0 and 1")
    if not 0 <= value <= 1:
        raise _upload_error("confidence must be between 0 and 1")
    return value


async def detect(
    request: Request,
    file: UploadFile,
    confidence_form: str | None = Form(None, alias="confidence"),
    confidence_query: str | None = Query(None, alias="confidence"),
    api_key: str = Depends(_valid_api_key),
):
    """Object detection via hosted API.

    ``confidence`` may be sent as a multipart form field (preferred, as the
    ``openeye api`` CLI does) or as a query parameter.
    """
    confidence = _resolve_confidence(confidence_form, confidence_query)
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
        obj
        for obj in result_data.get("objects", [])
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

    return JSONResponse(
        {
            "model": state.model_name,
            "image": {"width": w, "height": h},
            # Top-level width/height kept for backwards compatibility.
            "width": w,
            "height": h,
            "credits_used": credits_used,
            "depth_map": result_data.get("depth_map"),
            "inference_ms": result_data.get("inference_ms", 0),
        }
    )


async def describe(
    request: Request,
    file: UploadFile,
    prompt_form: str | None = Form(None, alias="prompt"),
    prompt_query: str | None = Query(None, alias="prompt"),
    api_key: str = Depends(_valid_api_key),
):
    """VLM scene description via hosted API.

    ``prompt`` may be sent as a multipart form field (as the hosted API and
    the ``openeye api`` CLI do) or as a query parameter.
    """
    prompt = prompt_form or prompt_query or _DEFAULT_PROMPT
    if len(prompt) > _MAX_PROMPT_LENGTH:
        raise _upload_error(f"Prompt too long (max {_MAX_PROMPT_LENGTH} characters)")
    state = get_state(request)
    img = await _read_image(file)
    w, h = img.size

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

    credits_used = _CREDITS.get("describe", 3)
    ledger = _get_ledger(request)
    ledger.record(api_key, state.model_name, "describe", credits_used)

    description = result_data.get("description", result_data.get("text", ""))
    return JSONResponse(
        {
            "model": state.model_name,
            "description": description,
            "image": {"width": w, "height": h},
            "credits_used": credits_used,
            "inference_ms": result_data.get("inference_ms", 0),
        }
    )
