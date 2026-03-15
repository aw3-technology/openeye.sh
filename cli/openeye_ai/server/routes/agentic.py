"""/ws/agentic — continuous perception + reasoning + planning loop."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from openeye_ai.server.metrics import INFERENCE_LATENCY
from openeye_ai.server.queue import QueueFullError
from openeye_ai.server.state import AppState
from openeye_ai.server.ws_utils import (
    VLM_INTERVAL_S,
    create_vlm_client,
    decode_base64_image,
    handle_ping,
    track_connection,
)

logger = logging.getLogger(__name__)


def create_router(state: AppState) -> APIRouter:
    router = APIRouter()

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
        async with track_connection(ws):
            pipeline = state.get_pipeline()

            vlm_client, nebius_model = create_vlm_client(state)

            # --- Agentic memory state (persists across frames) ---
            current_goal: str = ""
            objects_seen: dict[str, dict[str, Any]] = {}
            timeline: list[dict[str, Any]] = []
            frame_count: int = 0
            last_vlm_time: float = 0.0
            last_vlm_result: dict[str, Any] | None = None

            def _add_timeline_event(event: str, details: str) -> None:
                timeline.append(
                    {
                        "timestamp": time.time(),
                        "event": event,
                        "details": details,
                    }
                )
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
                        changes.append(
                            {"type": "appeared", "track_id": tid, "label": label}
                        )
                        _add_timeline_event("object_appeared", f"{label} (ID: {tid})")
                    else:
                        objects_seen[tid]["last_seen"] = now
                        objects_seen[tid]["count"] += 1

                # Detect disappearances (not seen for > 2 seconds)
                for tid, info in list(objects_seen.items()):
                    if tid not in current_ids and (now - info["last_seen"]) > 2.0:
                        if (now - info["last_seen"]) < 3.0:  # Only report once
                            changes.append(
                                {
                                    "type": "disappeared",
                                    "track_id": tid,
                                    "label": info["label"],
                                }
                            )
                            _add_timeline_event(
                                "object_disappeared", f"{info['label']} (ID: {tid})"
                            )

                return changes

            async def _run_vlm_reasoning(
                frame_b64: str, scene_desc: str, goal: str
            ) -> dict:
                """Send frame to VLM for high-level reasoning."""
                if not vlm_client:
                    return {
                        "description": "VLM not configured (missing NEBIUS_API_KEY).",
                        "reasoning": "",
                        "latency_ms": 0,
                    }

                goal_context = f" Current goal: {goal}." if goal else ""
                objects_summary = ", ".join(
                    f"{info['label']}"
                    for info in objects_seen.values()
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
                                            "image_url": {
                                                "url": f"data:image/jpeg;base64,{frame_b64}"
                                            },
                                        },
                                        {
                                            "type": "text",
                                            "text": f"Analyze this frame. Goal: {goal or 'observe and describe'}",
                                        },
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

                    if await handle_ping(raw, ws):
                        continue

                    # Parse JSON message
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
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
                        img = decode_base64_image(frame_b64)
                    except ValueError:
                        await ws.send_json({"error": "Invalid image data."})
                        continue

                    img_w, img_h = img.size
                    frame_np = np.array(img)
                    frame_count += 1
                    t_start = time.time()

                    # --- Stage 1: YOLO detection + scene graph (sub-100ms) ---
                    frame_dict = None
                    t_detect_start = time.time()

                    if pipeline is not None:

                        def run_agentic_pipeline():
                            return pipeline.process_frame(frame=frame_np)

                        try:
                            perception_frame = await state.inference_queue.submit(
                                run_agentic_pipeline
                            )
                            frame_dict = perception_frame.model_dump()
                            frame_dict = state.normalize_frame_bboxes(
                                frame_dict, img_w, img_h
                            )
                        except QueueFullError:
                            await ws.send_json({"error": "Server busy."})
                            continue
                        except Exception as e:
                            logger.error("Agentic pipeline failed: %s", e)
                            await ws.send_json(
                                {"error": "Pipeline failed. Please try again."}
                            )
                            continue
                    else:
                        # Fallback: basic detection
                        def run_basic_detect():
                            t0 = time.time()
                            result = state.adapter.predict(img)
                            INFERENCE_LATENCY.labels(model=state.model_name).observe(
                                time.time() - t0
                            )
                            return result

                        try:
                            detection_result = await state.inference_queue.submit(
                                run_basic_detect
                            )
                        except (QueueFullError, Exception):
                            await ws.send_json({"error": "Server busy."})
                            continue
                        frame_dict = {
                            "objects": detection_result.get("objects", []),
                            "scene_graph": {
                                "nodes": [],
                                "relationships": [],
                                "root_id": "scene",
                            },
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
                            frame_dict.setdefault("change_alerts", []).append(
                                {
                                    "change_type": f"object_{change['type']}",
                                    "description": f"{change['label']} {change['type']}",
                                    "affected_track_ids": [change["track_id"]],
                                    "magnitude": 1.0,
                                }
                            )

                    # --- Stage 3: VLM reasoning (throttled) ---
                    vlm_result = last_vlm_result
                    vlm_ms = 0.0
                    now = time.time()
                    if (now - last_vlm_time) >= VLM_INTERVAL_S:
                        vlm_result = await _run_vlm_reasoning(
                            frame_b64,
                            frame_dict.get("scene_description", ""),
                            current_goal,
                        )
                        last_vlm_time = now
                        last_vlm_result = vlm_result
                        vlm_ms = vlm_result.get("latency_ms", 0)
                        _add_timeline_event(
                            "vlm_reasoning",
                            vlm_result.get("description", "")[:100],
                        )

                    # --- Stage 4: Build action plan ---
                    action_plan = frame_dict.get("action_suggestions", [])
                    if current_goal and vlm_result:
                        vlm_desc = vlm_result.get("description", "")
                        if vlm_desc and not vlm_desc.startswith("VLM"):
                            action_plan.append(
                                {
                                    "action": "vlm_guided",
                                    "target_id": None,
                                    "reason": vlm_desc[:200],
                                    "priority": 0.6,
                                }
                            )

                    t_total_ms = (time.time() - t_start) * 1000

                    # --- Build memory snapshot ---
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
                            "timeline": timeline[-10:],
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

    return router
