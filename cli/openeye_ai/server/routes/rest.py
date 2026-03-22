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


# ────────────────────────────────────────────────────────────────────────
#  Viziera integration endpoints — REST wrappers for VLM analysis.
#  These let Viziera's testing engine send screenshots for structured
#  visual analysis without needing a WebSocket connection.
# ────────────────────────────────────────────────────────────────────────


@router.post("/vlm/analyze")
async def vlm_analyze(
    request: Request,
    file: UploadFile,
    prompt: Optional[str] = Query(
        None,
        description="Custom analysis prompt. If omitted, performs general visual bug detection.",
    ),
):
    """Run VLM analysis on an uploaded image and return structured JSON.

    Used by Viziera for visual bug detection, accessibility checks, and
    scene understanding. The VLM is prompted to return JSON so the result
    can be programmatically consumed.
    """
    import asyncio
    import base64

    from openeye_ai.vlm import create_async_vlm_client

    state = get_state(request)
    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        return JSONResponse({"error": "File too large."}, status_code=413)

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        return JSONResponse({"error": "Cannot decode image."}, status_code=400)

    # Resolve VLM provider
    nebius_key, nebius_base, nebius_model = state.resolve_vlm_model()
    vlm_client, _ = create_async_vlm_client(nebius_key, nebius_base, nebius_model)
    if not vlm_client:
        return JSONResponse(
            {"error": "VLM not configured. Set NEBIUS_API_KEY or OPENROUTER_API_KEY."},
            status_code=503,
        )

    # Encode as JPEG for VLM
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    default_prompt = (
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
                            {"type": "text", "text": prompt or default_prompt},
                        ],
                    },
                ],
                max_tokens=1024,
            ),
            timeout=30.0,
        )
        latency_ms = (time.time() - t0) * 1000
        content = resp.choices[0].message.content or ""

        # Track stats
        nebius_stats["total_calls"] += 1
        nebius_stats["total_latency_ms"] += latency_ms
        nebius_stats["avg_latency_ms"] = nebius_stats["total_latency_ms"] / nebius_stats["total_calls"]
        nebius_stats["last_call_at"] = time.time()

        # Try to extract JSON from the response
        import json as _json

        result: dict = {"raw": content, "inference_ms": round(latency_ms, 1)}
        try:
            # Find JSON in the response (may be wrapped in markdown code blocks)
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                parsed = _json.loads(content[json_start:json_end])
                result.update(parsed)
        except _json.JSONDecodeError:
            pass

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


@router.post("/perception")
async def perception_rest(
    request: Request,
    file: UploadFile,
):
    """Run the full perception pipeline on an uploaded image (REST).

    Returns the same scene graph, safety alerts, and spatial relationships
    as the /ws/perception WebSocket, but via a single REST call.
    """
    import numpy as np

    state = get_state(request)
    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        return JSONResponse({"error": "File too large."}, status_code=413)

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        return JSONResponse({"error": "Cannot decode image."}, status_code=400)

    img_w, img_h = img.size
    pipeline = state.get_pipeline()

    if pipeline is not None:
        frame_np = np.array(img)

        def run_pipeline():
            t0 = time.time()
            result = pipeline.process_frame(frame=frame_np)
            INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
            return result

        try:
            from openeye_ai.server.state import normalize_frame_bboxes

            perception_frame = await state.inference_queue.submit(run_pipeline)
            frame_dict = perception_frame.model_dump()
            frame_dict = normalize_frame_bboxes(frame_dict, img_w, img_h)
            return JSONResponse(frame_dict)
        except QueueFullError:
            return JSONResponse(
                {"error": "Server busy."},
                status_code=503,
                headers={"Retry-After": "5"},
            )
        except Exception as e:
            logger.error("Perception pipeline failed: %s", e)
            return JSONResponse({"error": "Pipeline failed."}, status_code=500)
    else:
        # No pipeline available — fall back to basic detection
        def run_basic():
            t0 = time.time()
            data = state.adapter.predict(img)
            INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
            return data

        try:
            result_data = await state.inference_queue.submit(run_basic)
        except QueueFullError:
            return JSONResponse(
                {"error": "Server busy."},
                status_code=503,
                headers={"Retry-After": "5"},
            )
        except Exception as e:
            logger.error("Detection failed: %s", e)
            return JSONResponse({"error": "Detection failed."}, status_code=500)

        result = PredictionResult(
            model=state.model_name,
            task=state.model_info["task"],
            image=ImageInfo(width=img_w, height=img_h, source=file.filename or "upload"),
            **result_data,
        )
        return JSONResponse(result.model_dump())
