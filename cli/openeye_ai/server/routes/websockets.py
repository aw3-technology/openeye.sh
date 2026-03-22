"""WebSocket routes for the OpenEye server."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from openeye_ai.schema import ImageInfo, PredictionResult
from openeye_ai.server.agentic_session import AgenticSession
from openeye_ai.server.metrics import ACTIVE_CONNECTIONS, INFERENCE_LATENCY
from openeye_ai.server.queue import QueueFullError
from openeye_ai.server.routes.ws_utils import decode_base64_image, submit_inference
from openeye_ai.server.state import get_state, normalize_frame_bboxes
from openeye_ai.vlm import create_async_vlm_client

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
                img, w, h = await decode_base64_image(data)
            except ValueError:
                await ws.send_json({"error": "Invalid image data. Send base64-encoded image."})
                continue

            def run_ws_inference():
                t0 = time.time()
                data = state.adapter.predict(img)
                INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
                return data

            result_data = await submit_inference(
                state.inference_queue, run_ws_inference, ws,
                error_msg="Server busy. Try again later.",
            )
            if result_data is None:
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
                img, img_w, img_h = await decode_base64_image(data)
            except ValueError:
                await ws.send_json({"error": "Invalid image data."})
                continue

            if pipeline is None:
                # Fallback: run basic detection without full pipeline
                def run_basic():
                    t0 = time.time()
                    result = state.adapter.predict(img)
                    INFERENCE_LATENCY.labels(model=state.model_name).observe(time.time() - t0)
                    return result

                result_data = await submit_inference(
                    state.inference_queue, run_basic, ws,
                    error_msg="Server busy.",
                )
                if result_data is None:
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

            perception_frame = await submit_inference(
                state.inference_queue, run_pipeline, ws,
                error_msg="Server busy.",
            )
            if perception_frame is None:
                continue

            frame_dict = perception_frame.model_dump()
            frame_dict = normalize_frame_bboxes(frame_dict, img_w, img_h)
            await ws.send_json(frame_dict)

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
    vlm_client, _ = create_async_vlm_client(nebius_key, nebius_base, nebius_model)

    session = AgenticSession(vlm_client=vlm_client, vlm_model=nebius_model)

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
                session.current_goal = msg["set_goal"]
                session.add_timeline_event("goal_updated", session.current_goal)
                if pipeline:
                    pipeline.set_goal(session.current_goal)
            if msg.get("goal"):
                session.current_goal = msg["goal"]

            if not frame_b64:
                await ws.send_json({"error": "No frame data provided."})
                continue

            # Decode frame
            try:
                img, img_w, img_h = await decode_base64_image(frame_b64)
            except ValueError:
                await ws.send_json({"error": "Invalid image data."})
                continue

            frame_np = np.array(img)
            session.frame_count += 1
            t_start = time.time()

            # --- Stage 1: YOLO detection + scene graph (sub-100ms) ---
            frame_dict: dict[str, Any] | None = None
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
            memory_changes = session.update_memory(frame_dict.get("objects", []))
            for change in memory_changes:
                if change not in (frame_dict.get("change_alerts") or []):
                    frame_dict.setdefault("change_alerts", []).append({
                        "change_type": f"object_{change['type']}",
                        "description": f"{change['label']} {change['type']}",
                        "affected_track_ids": [change["track_id"]],
                        "magnitude": 1.0,
                    })

            # --- Stage 3: VLM reasoning (throttled) ---
            vlm_result = session.last_vlm_result
            vlm_ms = 0.0
            now = time.time()
            if (now - session.last_vlm_time) >= session.cfg.vlm_interval:
                vlm_result = await session.run_vlm_reasoning(
                    frame_b64,
                    frame_dict.get("scene_description", ""),
                    session.current_goal,
                )
                session.last_vlm_time = now
                session.last_vlm_result = vlm_result
                vlm_ms = vlm_result.get("latency_ms", 0)
                session.add_timeline_event("vlm_reasoning", vlm_result.get("description", "")[:100])

            # --- Stage 4: Build action plan ---
            action_plan = frame_dict.get("action_suggestions", [])
            if session.current_goal and vlm_result:
                vlm_desc = vlm_result.get("description", "")
                if vlm_desc and not vlm_desc.startswith("VLM"):
                    action_plan.append({
                        "action": "vlm_guided",
                        "target_id": None,
                        "reason": vlm_desc[:200],
                        "priority": 0.6,
                    })

            t_total_ms = (time.time() - t_start) * 1000

            # --- Send result ---
            result = {
                "type": "agentic_frame",
                "frame_id": session.frame_count,
                "goal": session.current_goal,
                "detections": frame_dict.get("objects", []),
                "scene_graph": frame_dict.get("scene_graph", {}),
                "scene_description": frame_dict.get("scene_description", ""),
                "vlm_reasoning": vlm_result,
                "action_plan": action_plan,
                "safety_zones": frame_dict.get("safety_zones", []),
                "safety_alerts": frame_dict.get("safety_alerts", []),
                "change_alerts": frame_dict.get("change_alerts", []),
                "memory": session.build_memory_payload(),
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
