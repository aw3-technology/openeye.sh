"""/ws/desktop — desktop vision WebSocket route."""

from __future__ import annotations

import asyncio
import json
import logging
import time

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

    @router.websocket("/ws/desktop")
    async def websocket_desktop(ws: WebSocket):
        """Desktop vision: detect UI elements + VLM screen analysis.

        Protocol:
        - Client sends JSON: {"frame": "<base64>", "query": "optional find query"}
          - "frame" (required): base64-encoded JPEG/PNG of screen capture
          - "query" (optional): natural language element search query
        - Server responds with JSON: DesktopPerceptionResult or FindElementResult
        """
        async with track_connection(ws):
            vlm_client, nebius_model = create_vlm_client(state)

            last_vlm_time: float = 0.0
            last_vlm_result: dict | None = None
            frame_count: int = 0

            from openeye_ai.desktop.prompts import (
                DESKTOP_FIND_ELEMENT_PROMPT,
                DESKTOP_SYSTEM_PROMPT,
            )

            async def _run_desktop_vlm(
                frame_b64: str, system_prompt: str, user_text: str
            ) -> dict:
                """Send frame to VLM for desktop analysis."""
                if not vlm_client:
                    return {
                        "error": "VLM not configured (missing NEBIUS_API_KEY).",
                        "vlm_ms": 0,
                    }
                t0 = time.time()
                try:
                    resp = await asyncio.wait_for(
                        vlm_client.chat.completions.create(
                            model=nebius_model,
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "image_url",
                                            "image_url": {
                                                "url": f"data:image/jpeg;base64,{frame_b64}"
                                            },
                                        },
                                        {"type": "text", "text": user_text},
                                    ],
                                },
                            ],
                            max_tokens=1500,
                        ),
                        timeout=15.0,
                    )
                    latency = (time.time() - t0) * 1000
                    content = resp.choices[0].message.content or ""

                    # Track Nebius stats
                    state.nebius_stats["total_calls"] += 1
                    state.nebius_stats["total_latency_ms"] += latency
                    state.nebius_stats["avg_latency_ms"] = (
                        state.nebius_stats["total_latency_ms"]
                        / state.nebius_stats["total_calls"]
                    )
                    state.nebius_stats["last_call_at"] = time.time()

                    # Parse VLM JSON response
                    try:
                        cleaned = content.strip()
                        if cleaned.startswith("```"):
                            cleaned = cleaned.split("\n", 1)[1]
                            if cleaned.endswith("```"):
                                cleaned = cleaned[:-3]
                            cleaned = cleaned.strip()
                        parsed = json.loads(cleaned)
                        parsed["vlm_ms"] = round(latency, 1)
                        return parsed
                    except (json.JSONDecodeError, ValueError):
                        return {
                            "layout_description": content,
                            "active_window": {"title": "", "application": ""},
                            "ui_elements": [],
                            "text_regions": [],
                            "focused_element": None,
                            "vlm_ms": round(latency, 1),
                        }
                except asyncio.TimeoutError:
                    state.nebius_stats["errors"] += 1
                    return {
                        "error": "VLM timed out.",
                        "vlm_ms": round((time.time() - t0) * 1000, 1),
                    }
                except Exception as e:
                    state.nebius_stats["errors"] += 1
                    logger.error("Desktop VLM error: %s", e)
                    return {
                        "error": "VLM analysis failed.",
                        "vlm_ms": round((time.time() - t0) * 1000, 1),
                    }

            try:
                while True:
                    raw = await ws.receive_text()

                    if await handle_ping(raw, ws):
                        continue

                    # Parse JSON
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        msg = {"frame": raw}

                    frame_b64 = msg.get("frame", "")
                    query = msg.get("query", "")

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

                    # Stage 1: YOLO detection (for object-level detections)
                    detection_objects = []
                    t_detect_start = time.time()
                    try:

                        def run_desktop_detect():
                            t0 = time.time()
                            result = state.adapter.predict(img)
                            INFERENCE_LATENCY.labels(model=state.model_name).observe(
                                time.time() - t0
                            )
                            return result

                        detection_result = await state.inference_queue.submit(
                            run_desktop_detect
                        )
                        # Normalize bboxes to 0-1
                        for obj in detection_result.get("objects", []):
                            bbox = obj.get("bbox", {})
                            if bbox.get("x", 0) > 1 or bbox.get("y", 0) > 1:
                                obj["bbox"] = {
                                    "x": bbox.get("x", 0) / img_w,
                                    "y": bbox.get("y", 0) / img_h,
                                    "w": bbox.get("w", 0) / img_w,
                                    "h": bbox.get("h", 0) / img_h,
                                }
                        detection_objects = detection_result.get("objects", [])
                    except (QueueFullError, Exception) as e:
                        logger.warning("Desktop detection failed: %s", e)

                    t_detect_ms = (time.time() - t_detect_start) * 1000

                    # Stage 2: VLM analysis (throttled)
                    vlm_result = last_vlm_result
                    vlm_ms = 0.0
                    now = time.time()

                    if query:
                        # Targeted element search — always run VLM
                        vlm_result = await _run_desktop_vlm(
                            frame_b64,
                            DESKTOP_FIND_ELEMENT_PROMPT,
                            f"Find this element: {query}",
                        )
                        vlm_ms = vlm_result.get("vlm_ms", 0)
                        last_vlm_time = now
                    elif (now - last_vlm_time) >= VLM_INTERVAL_S:
                        # Full analysis (throttled)
                        vlm_result = await _run_desktop_vlm(
                            frame_b64,
                            DESKTOP_SYSTEM_PROMPT,
                            "Analyze this desktop screenshot.",
                        )
                        vlm_ms = vlm_result.get("vlm_ms", 0)
                        last_vlm_time = now
                        last_vlm_result = vlm_result

                    t_total_ms = (time.time() - t_start) * 1000

                    # Build response
                    result = {
                        "type": "desktop_frame",
                        "frame_id": frame_count,
                        "detections": detection_objects,
                        "active_window": (vlm_result or {}).get(
                            "active_window", {"title": "", "application": ""}
                        ),
                        "ui_elements": (vlm_result or {}).get("ui_elements", []),
                        "text_regions": (vlm_result or {}).get("text_regions", []),
                        "focused_element": (vlm_result or {}).get(
                            "focused_element", None
                        ),
                        "layout_description": (vlm_result or {}).get(
                            "layout_description", ""
                        ),
                        "latency": {
                            "detection_ms": round(t_detect_ms, 1),
                            "vlm_ms": round(vlm_ms, 1),
                            "total_ms": round(t_total_ms, 1),
                        },
                    }

                    # For find queries, add find-specific fields
                    if query:
                        result["type"] = "desktop_find"
                        result["found"] = (vlm_result or {}).get("found", False)
                        result["query"] = query
                        result["alternatives"] = (vlm_result or {}).get(
                            "alternatives", []
                        )

                    await ws.send_json(result)

            except WebSocketDisconnect:
                pass

    return router
