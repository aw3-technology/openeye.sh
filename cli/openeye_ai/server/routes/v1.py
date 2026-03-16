"""Hosted V1 API routes — /v1/detect, /v1/depth, /v1/describe, /v1/models, /v1/usage.

These routes serve the ``openeye api`` CLI client.  They wrap the same
adapter-based inference as ``/predict`` but add:
  - Bearer-token API-key authentication
  - Per-call credit tracking
  - Usage / balance reporting
"""

from __future__ import annotations

import io
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.queue import QueueFullError
from openeye_ai.server.state import get_state

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["hosted-api"])

_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB

# ── Credit costs per task ────────────────────────────────────────────

_CREDITS: dict[str, int] = {
    "detect": 1,
    "depth": 2,
    "describe": 5,
}


# ── In-process usage ledger ──────────────────────────────────────────


@dataclass
class _UsageRecord:
    calls: int = 0
    credits: int = 0


@dataclass
class _UsageLedger:
    """Tracks API usage per key.  In production this would be backed by a
    database; here we use a simple in-memory dict so the feature can be
    exercised end-to-end without external deps."""

    starting_credits: int = 1000
    _records: dict[str, dict[str, _UsageRecord]] = field(default_factory=dict)
    _history: list[dict[str, Any]] = field(default_factory=list)

    def record(self, api_key: str, model: str, task: str, credits: int) -> None:
        by_model = self._records.setdefault(api_key, {})
        rec = by_model.setdefault(model, _UsageRecord())
        rec.calls += 1
        rec.credits += credits
        self._history.append(
            {
                "api_key": api_key,
                "model": model,
                "task": task,
                "credits": credits,
                "timestamp": time.time(),
            }
        )

    def summary(self, api_key: str, days: int = 30) -> dict[str, Any]:
        cutoff = time.time() - days * 86400
        by_model = self._records.get(api_key, {})
        total_credits = sum(r.credits for r in by_model.values())
        total_calls = sum(r.calls for r in by_model.values())
        model_breakdown = {
            name: {"calls": r.calls, "credits": r.credits}
            for name, r in by_model.items()
        }
        recent = [h for h in self._history if h["api_key"] == api_key and h["timestamp"] >= cutoff]
        return {
            "credits_remaining": max(self.starting_credits - total_credits, 0),
            "credits_used": total_credits,
            "total_calls": total_calls,
            "by_model": model_breakdown,
            "recent_calls": len(recent),
        }


# Singleton ledger — mounted on app.state during create_app so tests can
# replace it if needed.
_default_ledger = _UsageLedger()


def _get_ledger(request: Request) -> _UsageLedger:
    return getattr(request.app.state, "usage_ledger", _default_ledger)


# ── Auth dependency ──────────────────────────────────────────────────


def _valid_api_key(authorization: str = Header(...)) -> str:
    """Validate ``Authorization: Bearer oe_...`` header.

    In production this would hit a key store; here we accept any key that
    starts with ``oe_`` (or matches ``OPENEYE_API_KEY`` when set on the
    server side).
    """
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _auth_error("Missing Bearer token")
    server_key = os.environ.get("OPENEYE_SERVER_API_KEY", "")
    if server_key and token != server_key:
        raise _auth_error("Invalid API key")
    if not token.startswith("oe_"):
        raise _auth_error("API key must start with oe_")
    return token


def _auth_error(detail: str):
    from fastapi import HTTPException
    return HTTPException(status_code=401, detail=detail)


# ── Shared helpers ───────────────────────────────────────────────────


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


# ── /v1/detect ───────────────────────────────────────────────────────


@router.post("/detect")
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


# ── /v1/depth ────────────────────────────────────────────────────────


@router.post("/depth")
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


# ── /v1/describe ─────────────────────────────────────────────────────


@router.post("/describe")
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


# ── /v1/models ───────────────────────────────────────────────────────


@router.get("/models")
async def models(
    request: Request,
    api_key: str = Depends(_valid_api_key),
):
    """List available models and credit costs."""
    state = get_state(request)
    task = state.model_info.get("task", "detection")
    return JSONResponse({
        "models": [
            {
                "name": state.model_name,
                "task": task,
                "credits_per_call": _CREDITS.get(task, 1),
                "description": state.model_info.get("description", ""),
            }
        ]
    })


# ── /v1/usage ────────────────────────────────────────────────────────


@router.get("/usage")
async def usage(
    request: Request,
    days: int = Query(30, ge=1, le=365),
    api_key: str = Depends(_valid_api_key),
):
    """Return credit balance and usage statistics."""
    ledger = _get_ledger(request)
    return JSONResponse(ledger.summary(api_key, days=days))
