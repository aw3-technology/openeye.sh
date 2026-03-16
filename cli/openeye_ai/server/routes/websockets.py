"""WebSocket routes for the OpenEye server."""

from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import time
from typing import Any, Optional

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from PIL import Image

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.metrics import ACTIVE_CONNECTIONS, INFERENCE_LATENCY
from openeye_ai.server.queue import QueueFullError
from openeye_ai.server.state import get_state, nebius_stats, normalize_frame_bboxes

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws")
async def websocket_predict(ws: WebSocket):
    await ws.accept()
    ACTIVE_CONNECTIONS.inc()
    state = get_state(ws)
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
                data = state.adapter.predict(img)
                INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
                return data

            try:
                result_data = await state.inference_queue.submit(run_ws_inference)
            except QueueFullError:
                await ws.send_json({"error": "Server busy. Try again later."})
                continue
            except Exception as e:
                logger.error("WS inference failed: %s", e)
                await ws.send_json({"error": "Inference failed. Please try again."})
                continue

            result = PredictionResult(
                model=state.model_name,
                task=state.model_info["task"],
                image=ImageInfo(width=w, height=h, source="websocket"),
                **result_data,
            )

            await ws.send_json(result.model_dump())

    except WebSocketDisconnect:
        pass
    finally:
        ACTIVE_CONNECTIONS.dec()


@router.websocket("/ws/perception")
async def websocket_perception(ws: WebSocket):
    await ws.accept()
    ACTIVE_CONNECTIONS.inc()
    state = get_state(ws)
    pipeline = state.get_pipeline()
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
                    result = state.adapter.predict(img)
                    INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
                    return result
                try:
                    result_data = await state.inference_queue.submit(run_basic)
                except (QueueFullError, Exception):
                    await ws.send_json({"error": "Server busy."})
                    continue
                result = PredictionResult(
                    model=state.model_name, task=state.model_info["task"],
                    image=ImageInfo(width=img_w, height=img_h, source="ws-perception"),
                    **result_data,
                )
                await ws.send_json(result.model_dump())
                continue

            frame_np = np.array(img)

            def run_pipeline():
                t0 = time.time()
                result = pipeline.process_frame(frame=frame_np)
                INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
                return result

            try:
                perception_frame = await state.inference_queue.submit(run_pipeline)
            except QueueFullError:
                await ws.send_json({"error": "Server busy."})
                continue
            except Exception as e:
                logger.error("Pipeline failed: %s", e)
                await ws.send_json({"error": "Pipeline failed. Please try again."})
                continue

            frame_dict = perception_frame.model_dump()
            frame_dict = normalize_frame_bboxes(frame_dict, img_w, img_h)
            await ws.send_json(frame_dict)

    except WebSocketDisconnect:
        pass
    finally:
        ACTIVE_CONNECTIONS.dec()


# ------------------------------------------------------------------ #
#  VLM endpoint (Nebius Token Factory)
# ------------------------------------------------------------------ #


@router.websocket("/ws/vlm")
async def websocket_vlm(ws: WebSocket):
    await ws.accept()
    ACTIVE_CONNECTIONS.inc()
    state = get_state(ws)

    nebius_key, nebius_base, nebius_model = state.resolve_vlm_model()

    vlm_client = None
    if nebius_key:
        nebius_stats["configured"] = True
        nebius_stats["model"] = nebius_model
        nebius_stats["provider"] = "OpenRouter" if "openrouter.ai" in nebius_base else "Nebius Token Factory"
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
                                    "You are OpenEye Perception OS analyzing a live camera feed.\n"
                                    "Respond in this exact format:\n\n"
                                    "SCENE: [1 sentence — what you see]\n"
                                    "OBJECTS: [comma-separated key objects with positions]\n"
                                    "HAZARDS: [safety concerns, or \"None detected\"]\n"
                                    "RISK: [SAFE / CAUTION / DANGER]\n"
                                    "ACTION: [recommended action]"
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
                nebius_stats["total_calls"] += 1
                nebius_stats["total_latency_ms"] += latency
                nebius_stats["avg_latency_ms"] = (
                    nebius_stats["total_latency_ms"] / nebius_stats["total_calls"]
                )
                nebius_stats["total_tokens_estimated"] += max(
                    getattr(resp.usage, "total_tokens", 0) if resp.usage else 0,
                    len(content.split()) * 2,  # rough estimate if usage not available
                )
                nebius_stats["last_call_at"] = time.time()
                await ws.send_json({
                    "description": content,
                    "reasoning": f"Analyzed by {nebius_model}",
                    "latency_ms": round(latency, 1),
                })
            except asyncio.TimeoutError:
                nebius_stats["errors"] += 1
                await ws.send_json({
                    "description": "VLM reasoning timed out.",
                    "reasoning": "Timeout after 10s",
                    "latency_ms": round((time.time() - t0) * 1000, 1),
                })
            except Exception as e:
                nebius_stats["errors"] += 1
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


@router.websocket("/ws/agentic")
async def websocket_agentic(ws: WebSocket):
    """Continuous agentic loop: detect -> scene graph -> VLM reason -> plan.

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
    state = get_state(ws)

    pipeline = state.get_pipeline()

    # VLM client (resolved from runtime config / env)
    nebius_key, nebius_base, nebius_model = state.resolve_vlm_model()
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
                                "You are OpenEye, an autonomous perception agent.\n"
                                f"Context: {scene_desc} | Objects: {objects_summary}\n"
                                f"{goal_context}\n\n"
                                "Respond exactly:\n"
                                "OBSERVATION: [what you see now]\n"
                                "ANALYSIS: [relevance to goal]\n"
                                "NEXT_ACTION: [specific recommendation]\n"
                                "CONFIDENCE: [HIGH/MEDIUM/LOW]"
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
                    max_tokens=300,
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
                    perception_frame = await state.inference_queue.submit(run_agentic_pipeline)
                    frame_dict = perception_frame.model_dump()
                    frame_dict = normalize_frame_bboxes(frame_dict, img_w, img_h)
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
                    result = state.adapter.predict(img)
                    INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
                    return result

                try:
                    detection_result = await state.inference_queue.submit(run_basic_detect)
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
