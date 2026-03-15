"""FastAPI app factory — REST + WebSocket + browser dashboard."""

from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

import numpy as np
from fastapi import FastAPI, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from PIL import Image, UnidentifiedImageError
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.metrics import (
    ACTIVE_CONNECTIONS,
    INFERENCE_LATENCY,
    MODEL_INFO,
    REQUEST_COUNT,
    REQUEST_LATENCY,
)
from openeye_ai.server.queue import InferenceQueue, QueueFullError
from openeye_ai.server.rate_limit import PREDICT_LIMIT, limiter

# Add backend/src to path for perception pipeline imports
_BACKEND_SRC = str(Path(__file__).resolve().parents[3] / "backend" / "src")
if _BACKEND_SRC not in sys.path:
    sys.path.insert(0, _BACKEND_SRC)

logger = logging.getLogger(__name__)

_DASHBOARD_PATH = Path(__file__).parent / "dashboard.html"

# Max upload size: 20 MB
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024

_START_TIME: float = 0.0

# Nebius VLM usage tracking (shared across connections)
_nebius_stats: dict[str, Any] = {
    "total_calls": 0,
    "total_tokens_estimated": 0,
    "total_latency_ms": 0.0,
    "avg_latency_ms": 0.0,
    "errors": 0,
    "last_call_at": None,
    "model": "",
    "provider": "Nebius Token Factory",
    "configured": False,
}


def create_app(
    adapter,
    model_name: str,
    model_info: dict[str, Any],
    vlm_model: str | None = None,
    cortex_llm: str | None = None,
) -> FastAPI:
    global _START_TIME
    _START_TIME = time.time()

    app = FastAPI(title=f"OpenEye — {model_info['name']}", version="0.1.0")

    # Rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    allowed_origins = [
        o.strip()
        for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
        if o.strip()
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    )

    # Mount MLOps router
    from openeye_ai.mlops.api import router as mlops_router

    app.include_router(mlops_router)

    # Mount Agent router
    from openeye_ai.server.agent_router import router as agent_router

    app.include_router(agent_router)

    # Mount Governance router
    try:
        from governance.router import router as governance_router, set_engine as set_governance_engine
        app.include_router(governance_router)
    except ImportError:
        governance_router = None
        logger.info("Governance router not available")

    # Set model info metric
    MODEL_INFO.info({"model": model_name, "task": model_info["task"]})

    # Inference queue (serializes inference, max 1 concurrent)
    inference_queue = InferenceQueue(max_concurrent=1, max_queue_size=16)

    # Mutable runtime config (seeded from CLI flags)
    _runtime_config: dict[str, Any] = {}
    if vlm_model:
        _runtime_config["vlm_model"] = vlm_model
    if cortex_llm:
        _runtime_config["cortex_llm"] = cortex_llm

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = time.time() - start
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
        ).inc()
        REQUEST_LATENCY.labels(
            method=request.method,
            endpoint=request.url.path,
        ).observe(duration)
        return response

    @app.get("/", response_class=HTMLResponse)
    async def dashboard():
        return _DASHBOARD_PATH.read_text()

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "model": model_name,
            "model_loaded": adapter._loaded if hasattr(adapter, "_loaded") else True,
            "uptime_seconds": round(time.time() - _START_TIME, 1),
        }

    @app.post("/predict")
    @limiter.limit(PREDICT_LIMIT)
    async def predict(
        request: Request,
        file: UploadFile,
        prompt: Optional[str] = Query(None, description="Text prompt (for grounding-dino)"),
    ):
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
            if prompt and hasattr(adapter, "predict_with_prompt"):
                data = adapter.predict_with_prompt(img, prompt)
            else:
                data = adapter.predict(img)
            INFERENCE_LATENCY.labels(model=model_name).observe(time.time() - t0)
            return data

        try:
            result_data = await inference_queue.submit(run_inference)
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
            model=model_name,
            task=model_info["task"],
            image=ImageInfo(width=w, height=h, source=file.filename or "upload"),
            **result_data,
        )
        return JSONResponse(result.model_dump())

    @app.get("/metrics")
    async def metrics():
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST,
        )

    @app.get("/queue/status")
    async def queue_status():
        return {
            "active": inference_queue.active_count,
            "queued": inference_queue.queue_size,
        }

    @app.get("/nebius/stats")
    async def nebius_stats():
        """Return Nebius Token Factory VLM usage statistics."""
        stats = dict(_nebius_stats)
        stats["uptime_seconds"] = round(time.time() - _START_TIME, 1)
        return JSONResponse(stats)

    @app.get("/config")
    async def get_config():
        return JSONResponse(_runtime_config)

    @app.put("/config")
    async def put_config(request: Request):
        config = await request.json()
        _runtime_config.clear()
        _runtime_config.update(config)
        return {"status": "ok"}

    @app.websocket("/ws")
    async def websocket_predict(ws: WebSocket):
        await ws.accept()
        ACTIVE_CONNECTIONS.inc()
        try:
            while True:
                data = await ws.receive_text()

                if data == "camera":
                    await ws.send_json({"error": "Server-side camera not supported via WebSocket. Send a base64 image."})
                    continue

                # Expect base64-encoded image
                try:
                    img_bytes = base64.b64decode(data)
                    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                except Exception:
                    await ws.send_json({"error": "Invalid image data. Send base64-encoded image."})
                    continue

                w, h = img.size

                def run_ws_inference():
                    t0 = time.time()
                    data = adapter.predict(img)
                    INFERENCE_LATENCY.labels(model=model_name).observe(time.time() - t0)
                    return data

                try:
                    result_data = await inference_queue.submit(run_ws_inference)
                except QueueFullError:
                    await ws.send_json({"error": "Server busy. Try again later."})
                    continue
                except Exception as e:
                    logger.error("WS inference failed: %s", e)
                    await ws.send_json({"error": "Inference failed. Please try again."})
                    continue

                result = PredictionResult(
                    model=model_name,
                    task=model_info["task"],
                    image=ImageInfo(width=w, height=h, source="websocket"),
                    **result_data,
                )

                await ws.send_json(result.model_dump())

        except WebSocketDisconnect:
            pass
        finally:
            ACTIVE_CONNECTIONS.dec()

    # ------------------------------------------------------------------ #
    #  Perception pipeline (lazy init, shared across connections)
    # ------------------------------------------------------------------ #
    _pipeline = None
    _governance_engine = None

    def _init_governance():
        nonlocal _governance_engine
        if _governance_engine is not None:
            return _governance_engine
        gov_config = _runtime_config.get("governance_config")
        if gov_config:
            try:
                from governance.engine import GovernanceEngine
                _governance_engine = GovernanceEngine(config_path=gov_config)
                if governance_router is not None:
                    set_governance_engine(_governance_engine)
                logger.info("Governance engine loaded: %s", gov_config)
            except Exception as e:
                logger.warning("Failed to init governance engine: %s", e)
        return _governance_engine

    def _get_pipeline():
        nonlocal _pipeline
        if _pipeline is None:
            try:
                from perception.pipeline import PerceptionPipeline
                def detector_fn(frame_np):
                    img = Image.fromarray(frame_np)
                    return adapter.predict(img).get("objects", [])
                gov = _init_governance()
                _pipeline = PerceptionPipeline(detector=detector_fn, governance_engine=gov)
            except ImportError as e:
                logger.warning(f"PerceptionPipeline not available: {e}")
                return None
        return _pipeline

    def _bbox2d_to_norm(bbox_dict: dict, img_w: int, img_h: int) -> dict:
        """Convert BBox2D (x1,y1,x2,y2 pixels) → BBox (x,y,w,h normalized)."""
        x1, y1 = bbox_dict.get("x1", 0), bbox_dict.get("y1", 0)
        x2, y2 = bbox_dict.get("x2", 0), bbox_dict.get("y2", 0)
        return {
            "x": x1 / img_w if img_w else 0,
            "y": y1 / img_h if img_h else 0,
            "w": (x2 - x1) / img_w if img_w else 0,
            "h": (y2 - y1) / img_h if img_h else 0,
        }

    def _normalize_frame_bboxes(frame_dict: dict, img_w: int, img_h: int) -> dict:
        """Normalize all BBox2D in a PerceptionFrame dict to BBox format."""
        for obj in frame_dict.get("objects", []):
            if "bbox" in obj and "x1" in obj["bbox"]:
                obj["bbox"] = _bbox2d_to_norm(obj["bbox"], img_w, img_h)
        return frame_dict

    @app.websocket("/ws/perception")
    async def websocket_perception(ws: WebSocket):
        await ws.accept()
        ACTIVE_CONNECTIONS.inc()
        pipeline = _get_pipeline()
        try:
            while True:
                data = await ws.receive_text()
                try:
                    img_bytes = base64.b64decode(data)
                    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                except Exception:
                    await ws.send_json({"error": "Invalid image data."})
                    continue

                img_w, img_h = img.size

                if pipeline is None:
                    # Fallback: run basic detection without full pipeline
                    def run_basic():
                        t0 = time.time()
                        result = adapter.predict(img)
                        INFERENCE_LATENCY.labels(model=model_name).observe(time.time() - t0)
                        return result
                    try:
                        result_data = await inference_queue.submit(run_basic)
                    except (QueueFullError, Exception):
                        await ws.send_json({"error": "Server busy."})
                        continue
                    result = PredictionResult(
                        model=model_name, task=model_info["task"],
                        image=ImageInfo(width=img_w, height=img_h, source="ws-perception"),
                        **result_data,
                    )
                    await ws.send_json(result.model_dump())
                    continue

                frame_np = np.array(img)

                def run_pipeline():
                    t0 = time.time()
                    result = pipeline.process_frame(frame=frame_np)
                    INFERENCE_LATENCY.labels(model=model_name).observe(time.time() - t0)
                    return result

                try:
                    perception_frame = await inference_queue.submit(run_pipeline)
                except QueueFullError:
                    await ws.send_json({"error": "Server busy."})
                    continue
                except Exception as e:
                    logger.error("Pipeline failed: %s", e)
                    await ws.send_json({"error": "Pipeline failed. Please try again."})
                    continue

                frame_dict = perception_frame.model_dump()
                frame_dict = _normalize_frame_bboxes(frame_dict, img_w, img_h)
                await ws.send_json(frame_dict)

        except WebSocketDisconnect:
            pass
        finally:
            ACTIVE_CONNECTIONS.dec()

    # ------------------------------------------------------------------ #
    #  VLM endpoint (Nebius Token Factory)
    # ------------------------------------------------------------------ #

    def _resolve_vlm_model() -> tuple[str, str, str]:
        """Resolve VLM provider config: (api_key, base_url, model).

        Priority: runtime config vlm_model > CLI flag > NEBIUS_MODEL env > default.
        Auto-detects provider (OpenRouter vs Nebius) from the model ID format.
        """
        cfg_model = _runtime_config.get("vlm_model", "")
        env_model = os.environ.get("NEBIUS_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct")
        model = cfg_model or env_model

        # OpenRouter model IDs use lowercase org/model or contain ":free"
        is_openrouter = "/" in model and (
            model.split("/")[0].islower() or ":free" in model
        )

        if is_openrouter:
            api_key = os.environ.get("OPENROUTER_API_KEY", "")
            base_url = "https://openrouter.ai/api/v1"
        else:
            api_key = os.environ.get("NEBIUS_API_KEY", "")
            base_url = os.environ.get("NEBIUS_BASE_URL", "https://api.studio.nebius.com/v1")

        return api_key, base_url, model

    @app.websocket("/ws/vlm")
    async def websocket_vlm(ws: WebSocket):
        await ws.accept()
        ACTIVE_CONNECTIONS.inc()

        nebius_key, nebius_base, nebius_model = _resolve_vlm_model()

        vlm_client = None
        if nebius_key:
            _nebius_stats["configured"] = True
            _nebius_stats["model"] = nebius_model
            _nebius_stats["provider"] = "OpenRouter" if "openrouter.ai" in nebius_base else "Nebius Token Factory"
            try:
                import openai
                vlm_client = openai.AsyncOpenAI(base_url=nebius_base, api_key=nebius_key)
            except ImportError:
                logger.warning("openai package not installed — VLM endpoint disabled")

        try:
            while True:
                data = await ws.receive_text()

                if not vlm_client:
                    await ws.send_json({
                        "description": "VLM not configured (missing NEBIUS_API_KEY).",
                        "reasoning": "",
                        "latency_ms": 0,
                    })
                    continue

                t0 = time.time()
                try:
                    resp = await asyncio.wait_for(
                        vlm_client.chat.completions.create(
                            model=nebius_model,
                            messages=[
                                {
                                    "role": "system",
                                    "content": (
                                        "You are a safety-focused vision analyst for a robotic workspace. "
                                        "Analyze the camera frame and provide: 1) A concise scene description, "
                                        "2) Any safety hazards or concerns, 3) Recommended actions. "
                                        "Be concise and direct. Focus on human-robot safety."
                                    ),
                                },
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "image_url",
                                            "image_url": {"url": f"data:image/jpeg;base64,{data}"},
                                        },
                                        {"type": "text", "text": "Analyze this workspace frame for safety."},
                                    ],
                                },
                            ],
                            max_tokens=300,
                        ),
                        timeout=10.0,
                    )
                    latency = (time.time() - t0) * 1000
                    content = resp.choices[0].message.content or ""
                    # Track Nebius usage stats
                    _nebius_stats["total_calls"] += 1
                    _nebius_stats["total_latency_ms"] += latency
                    _nebius_stats["avg_latency_ms"] = (
                        _nebius_stats["total_latency_ms"] / _nebius_stats["total_calls"]
                    )
                    _nebius_stats["total_tokens_estimated"] += max(
                        getattr(resp.usage, "total_tokens", 0) if resp.usage else 0,
                        len(content.split()) * 2,  # rough estimate if usage not available
                    )
                    _nebius_stats["last_call_at"] = time.time()
                    await ws.send_json({
                        "description": content,
                        "reasoning": f"Analyzed by {nebius_model}",
                        "latency_ms": round(latency, 1),
                    })
                except asyncio.TimeoutError:
                    _nebius_stats["errors"] += 1
                    await ws.send_json({
                        "description": "VLM reasoning timed out.",
                        "reasoning": "Timeout after 10s",
                        "latency_ms": round((time.time() - t0) * 1000, 1),
                    })
                except Exception as e:
                    _nebius_stats["errors"] += 1
                    logger.error("VLM error: %s", e)
                    await ws.send_json({
                        "description": "VLM reasoning failed.",
                        "reasoning": "",
                        "latency_ms": round((time.time() - t0) * 1000, 1),
                    })

        except WebSocketDisconnect:
            pass
        finally:
            ACTIVE_CONNECTIONS.dec()

    # ------------------------------------------------------------------ #
    #  Agentic Loop endpoint — continuous perception + reasoning + planning
    # ------------------------------------------------------------------ #

    @app.websocket("/ws/agentic")
    async def websocket_agentic(ws: WebSocket):
        """Continuous agentic loop: detect → scene graph → VLM reason → plan.

        Protocol:
        - Client sends JSON: {"frame": "<base64>", "goal": "...", "set_goal": "..."}
          - "frame" (required): base64-encoded JPEG frame
          - "goal" (optional): current goal for action planning
          - "set_goal" (optional): update the active goal
        - Server responds with JSON:
          {
            "type": "agentic_frame",
            "detections": [...],
            "scene_graph": {...},
            "scene_description": "...",
            "vlm_reasoning": {...} | null,
            "action_plan": [...],
            "safety_zones": [...],
            "safety_alerts": [...],
            "change_alerts": [...],
            "memory": {"objects_seen": {...}, "timeline": [...], "frame_count": N},
            "latency": {"detection_ms": ..., "total_ms": ..., "vlm_ms": ...},
            "goal": "current goal",
            "frame_id": N
          }
        """
        await ws.accept()
        ACTIVE_CONNECTIONS.inc()

        pipeline = _get_pipeline()

        # VLM client (resolved from runtime config / env)
        nebius_key, nebius_base, nebius_model = _resolve_vlm_model()
        vlm_client = None
        if nebius_key:
            try:
                import openai
                vlm_client = openai.AsyncOpenAI(base_url=nebius_base, api_key=nebius_key)
            except ImportError:
                logger.warning("openai package not installed — VLM disabled for agentic loop")

        # --- Agentic memory state (persists across frames) ---
        current_goal: str = ""
        objects_seen: dict[str, dict[str, Any]] = {}  # track_id -> {label, first_seen, last_seen, count}
        timeline: list[dict[str, Any]] = []  # [{timestamp, event, details}]
        frame_count: int = 0
        last_vlm_time: float = 0.0
        last_vlm_result: Optional[dict[str, Any]] = None
        vlm_interval: float = 3.0  # seconds between VLM calls

        def _add_timeline_event(event: str, details: str) -> None:
            timeline.append({
                "timestamp": time.time(),
                "event": event,
                "details": details,
            })
            # Keep last 50 events
            if len(timeline) > 50:
                timeline.pop(0)

        def _update_memory(objects: list[dict]) -> list[dict]:
            """Track objects across frames. Returns change events."""
            now = time.time()
            changes: list[dict] = []
            current_ids = set()

            for obj in objects:
                tid = obj.get("track_id", "")
                label = obj.get("label", "unknown")
                current_ids.add(tid)

                if tid not in objects_seen:
                    objects_seen[tid] = {
                        "label": label,
                        "first_seen": now,
                        "last_seen": now,
                        "count": 1,
                    }
                    changes.append({"type": "appeared", "track_id": tid, "label": label})
                    _add_timeline_event("object_appeared", f"{label} (ID: {tid})")
                else:
                    objects_seen[tid]["last_seen"] = now
                    objects_seen[tid]["count"] += 1

            # Detect disappearances (not seen for > 2 seconds)
            for tid, info in list(objects_seen.items()):
                if tid not in current_ids and (now - info["last_seen"]) > 2.0:
                    if (now - info["last_seen"]) < 3.0:  # Only report once
                        changes.append({"type": "disappeared", "track_id": tid, "label": info["label"]})
                        _add_timeline_event("object_disappeared", f"{info['label']} (ID: {tid})")

            return changes

        async def _run_vlm_reasoning(frame_b64: str, scene_desc: str, goal: str) -> dict:
            """Send frame to VLM for high-level reasoning."""
            if not vlm_client:
                return {
                    "description": "VLM not configured (missing NEBIUS_API_KEY).",
                    "reasoning": "",
                    "latency_ms": 0,
                }

            goal_context = f" Current goal: {goal}." if goal else ""
            objects_summary = ", ".join(
                f"{info['label']}" for info in objects_seen.values()
                if (time.time() - info["last_seen"]) < 5.0
            )

            t0 = time.time()
            try:
                resp = await asyncio.wait_for(
                    vlm_client.chat.completions.create(
                        model=nebius_model,
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "You are an agentic vision system for a robot. "
                                    "Analyze the scene and provide actionable reasoning. "
                                    f"Scene context: {scene_desc}. "
                                    f"Objects tracked: {objects_summary}."
                                    f"{goal_context} "
                                    "Respond with: 1) What you observe, 2) How it relates to the goal, "
                                    "3) What action to take next. Be concise (2-3 sentences max)."
                                ),
                            },
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "image_url",
                                        "image_url": {"url": f"data:image/jpeg;base64,{frame_b64}"},
                                    },
                                    {"type": "text", "text": f"Analyze this frame. Goal: {goal or 'observe and describe'}"},
                                ],
                            },
                        ],
                        max_tokens=200,
                    ),
                    timeout=10.0,
                )
                latency = (time.time() - t0) * 1000
                content = resp.choices[0].message.content or ""
                return {
                    "description": content,
                    "reasoning": f"Analyzed by {nebius_model}",
                    "latency_ms": round(latency, 1),
                }
            except asyncio.TimeoutError:
                return {
                    "description": "VLM reasoning timed out.",
                    "reasoning": "Timeout after 10s",
                    "latency_ms": round((time.time() - t0) * 1000, 1),
                }
            except Exception as e:
                logger.error("Agentic VLM error: %s", e)
                return {
                    "description": "VLM reasoning failed.",
                    "reasoning": "",
                    "latency_ms": round((time.time() - t0) * 1000, 1),
                }

        try:
            while True:
                raw = await ws.receive_text()

                # Handle ping
                if raw == "ping":
                    await ws.send_text("pong")
                    continue

                # Parse JSON message
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    # Treat as raw base64 frame (backwards compat)
                    msg = {"frame": raw}

                frame_b64 = msg.get("frame", "")
                if msg.get("set_goal"):
                    current_goal = msg["set_goal"]
                    _add_timeline_event("goal_updated", current_goal)
                    if pipeline:
                        pipeline.set_goal(current_goal)
                if msg.get("goal"):
                    current_goal = msg["goal"]

                if not frame_b64:
                    await ws.send_json({"error": "No frame data provided."})
                    continue

                # Decode frame
                try:
                    img_bytes = base64.b64decode(frame_b64)
                    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                except Exception:
                    await ws.send_json({"error": "Invalid image data."})
                    continue

                img_w, img_h = img.size
                frame_np = np.array(img)
                frame_count += 1
                t_start = time.time()

                # --- Stage 1: YOLO detection + scene graph (sub-100ms) ---
                detection_result = None
                frame_dict = None
                t_detect_start = time.time()

                if pipeline is not None:
                    def run_agentic_pipeline():
                        return pipeline.process_frame(frame=frame_np)

                    try:
                        perception_frame = await inference_queue.submit(run_agentic_pipeline)
                        frame_dict = perception_frame.model_dump()
                        frame_dict = _normalize_frame_bboxes(frame_dict, img_w, img_h)
                    except QueueFullError:
                        await ws.send_json({"error": "Server busy."})
                        continue
                    except Exception as e:
                        logger.error("Agentic pipeline failed: %s", e)
                        await ws.send_json({"error": "Pipeline failed. Please try again."})
                        continue
                else:
                    # Fallback: basic detection
                    def run_basic_detect():
                        t0 = time.time()
                        result = adapter.predict(img)
                        INFERENCE_LATENCY.labels(model=model_name).observe(time.time() - t0)
                        return result

                    try:
                        detection_result = await inference_queue.submit(run_basic_detect)
                    except (QueueFullError, Exception):
                        await ws.send_json({"error": "Server busy."})
                        continue
                    frame_dict = {
                        "objects": detection_result.get("objects", []),
                        "scene_graph": {"nodes": [], "relationships": [], "root_id": "scene"},
                        "scene_description": "",
                        "safety_alerts": [],
                        "safety_zones": [],
                        "action_suggestions": [],
                        "change_alerts": [],
                    }

                t_detect_ms = (time.time() - t_detect_start) * 1000

                # --- Stage 2: Update memory ---
                memory_changes = _update_memory(frame_dict.get("objects", []))
                for change in memory_changes:
                    if change not in (frame_dict.get("change_alerts") or []):
                        frame_dict.setdefault("change_alerts", []).append({
                            "change_type": f"object_{change['type']}",
                            "description": f"{change['label']} {change['type']}",
                            "affected_track_ids": [change["track_id"]],
                            "magnitude": 1.0,
                        })

                # --- Stage 3: VLM reasoning (throttled to every 3s) ---
                vlm_result = last_vlm_result
                vlm_ms = 0.0
                now = time.time()
                if (now - last_vlm_time) >= vlm_interval:
                    vlm_result = await _run_vlm_reasoning(
                        frame_b64,
                        frame_dict.get("scene_description", ""),
                        current_goal,
                    )
                    last_vlm_time = now
                    last_vlm_result = vlm_result
                    vlm_ms = vlm_result.get("latency_ms", 0)
                    _add_timeline_event("vlm_reasoning", vlm_result.get("description", "")[:100])

                # --- Stage 4: Build action plan ---
                action_plan = frame_dict.get("action_suggestions", [])
                if current_goal and vlm_result:
                    # Augment action plan with VLM-informed steps
                    vlm_desc = vlm_result.get("description", "")
                    if vlm_desc and not vlm_desc.startswith("VLM"):
                        action_plan.append({
                            "action": "vlm_guided",
                            "target_id": None,
                            "reason": vlm_desc[:200],
                            "priority": 0.6,
                        })

                t_total_ms = (time.time() - t_start) * 1000

                # --- Build memory snapshot ---
                # Only include recently-seen objects in the summary
                active_objects = {
                    tid: {
                        "label": info["label"],
                        "frames_seen": info["count"],
                        "seconds_tracked": round(now - info["first_seen"], 1),
                    }
                    for tid, info in objects_seen.items()
                    if (now - info["last_seen"]) < 10.0
                }

                # --- Send result ---
                result = {
                    "type": "agentic_frame",
                    "frame_id": frame_count,
                    "goal": current_goal,
                    "detections": frame_dict.get("objects", []),
                    "scene_graph": frame_dict.get("scene_graph", {}),
                    "scene_description": frame_dict.get("scene_description", ""),
                    "vlm_reasoning": vlm_result,
                    "action_plan": action_plan,
                    "safety_zones": frame_dict.get("safety_zones", []),
                    "safety_alerts": frame_dict.get("safety_alerts", []),
                    "change_alerts": frame_dict.get("change_alerts", []),
                    "memory": {
                        "objects_seen": active_objects,
                        "timeline": timeline[-10:],  # Last 10 events
                        "frame_count": frame_count,
                        "total_objects_tracked": len(objects_seen),
                    },
                    "latency": {
                        "detection_ms": round(t_detect_ms, 1),
                        "vlm_ms": round(vlm_ms, 1),
                        "total_ms": round(t_total_ms, 1),
                    },
                }
                await ws.send_json(result)

        except WebSocketDisconnect:
            pass
        finally:
            ACTIVE_CONNECTIONS.dec()

    return app
