"""REST API routes for the OpenEye server."""

from __future__ import annotations

import io
import logging
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, Response
from PIL import Image, UnidentifiedImageError
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.metrics import INFERENCE_LATENCY
from openeye_ai.server.queue import QueueFullError
from openeye_ai.server.rate_limit import PREDICT_LIMIT, limiter
from openeye_ai.server.state import get_state, nebius_stats

logger = logging.getLogger(__name__)

_DASHBOARD_PATH = Path(__file__).resolve().parents[1] / "dashboard.html"

# Max upload size: 20 MB
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024

router = APIRouter()


@router.get("/", response_class=HTMLResponse)
async def dashboard():
    return _DASHBOARD_PATH.read_text()


@router.get("/health")
async def health(request: Request):
    state = get_state(request)
    return {
        "status": "ok",
        "model": state.model_name,
        "model_display_name": state.model_info.get("name", state.model_name),
        "task": state.model_info.get("task", "unknown"),
        "model_loaded": state.adapter._loaded if hasattr(state.adapter, "_loaded") else True,
        "uptime_seconds": round(time.time() - state.start_time, 1),
        "queue": {
            "active": state.inference_queue.active_count,
            "queued": state.inference_queue.queue_size,
        },
    }


@router.post("/predict")
@limiter.limit(PREDICT_LIMIT)
async def predict(
    request: Request,
    file: UploadFile,
    prompt: Optional[str] = Query(None, description="Text prompt (for grounding-dino)"),
):
    state = get_state(request)
    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        return JSONResponse(
            {"error": f"File too large ({len(contents)} bytes). Max: {_MAX_UPLOAD_BYTES}."},
            status_code=413,
        )

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        return JSONResponse({"error": "Cannot decode image."}, status_code=400)

    w, h = img.size

    def run_inference():
        t0 = time.time()
        if prompt and hasattr(state.adapter, "predict_with_prompt"):
            data = state.adapter.predict_with_prompt(img, prompt)
        else:
            data = state.adapter.predict(img)
        INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
        return data

    try:
        result_data = await state.inference_queue.submit(run_inference)
    except QueueFullError:
        return JSONResponse(
            {"error": "Server busy. Try again later."},
            status_code=503,
            headers={"Retry-After": "5"},
        )
    except Exception as e:
        logger.error("Inference failed: %s", e)
        return JSONResponse({"error": "Inference failed. Please try again."}, status_code=500)

    result = PredictionResult(
        model=state.model_name,
        task=state.model_info["task"],
        image=ImageInfo(width=w, height=h, source=file.filename or "upload"),
        **result_data,
    )
    return JSONResponse(result.model_dump())


@router.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )


@router.get("/queue/status")
async def queue_status(request: Request):
    state = get_state(request)
    active = state.inference_queue.active_count
    queued = state.inference_queue.queue_size
    max_size = state.inference_queue.max_queue_size
    capacity_pct = round((queued / max_size) * 100, 1) if max_size else 0.0
    if active == 0 and queued == 0:
        status = "idle"
    elif queued >= max_size:
        status = "overloaded"
    elif capacity_pct > 50:
        status = "busy"
    else:
        status = "processing"
    return {
        "status": status,
        "active": active,
        "queued": queued,
        "max_queue_size": max_size,
        "capacity_percent": capacity_pct,
    }


@router.get("/nebius/stats")
async def nebius_stats_endpoint(request: Request):
    """Return Nebius Token Factory VLM usage statistics."""
    state = get_state(request)
    stats = dict(nebius_stats)
    stats["uptime_seconds"] = round(time.time() - state.start_time, 1)
    # Estimate cost based on token usage (rough per-1K-token pricing)
    tokens = stats.get("total_tokens_estimated", 0)
    stats["estimated_cost_usd"] = round(tokens * 0.0002, 4)  # ~$0.20 per 1K tokens
    return JSONResponse(stats)


@router.get("/config")
async def get_config(request: Request):
    state = get_state(request)
    return JSONResponse(state.runtime_config)


@router.put("/config")
async def put_config(request: Request):
    state = get_state(request)
    config = await request.json()
    state.runtime_config.clear()
    state.runtime_config.update(config)
    return {"status": "ok"}
