"""/ws/vlm — VLM reasoning WebSocket route (Nebius Token Factory)."""

from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from openeye_ai.server.state import AppState
from openeye_ai.server.ws_utils import create_vlm_client, track_connection

logger = logging.getLogger(__name__)


def create_router(state: AppState) -> APIRouter:
    router = APIRouter()

    @router.websocket("/ws/vlm")
    async def websocket_vlm(ws: WebSocket):
        async with track_connection(ws):
            vlm_client, nebius_model = create_vlm_client(state)

            try:
                while True:
                    data = await ws.receive_text()

                    if not vlm_client:
                        await ws.send_json(
                            {
                                "description": "VLM not configured (missing NEBIUS_API_KEY).",
                                "reasoning": "",
                                "latency_ms": 0,
                            }
                        )
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
                                                "image_url": {
                                                    "url": f"data:image/jpeg;base64,{data}"
                                                },
                                            },
                                            {
                                                "type": "text",
                                                "text": "Analyze this workspace frame for safety.",
                                            },
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
                        state.nebius_stats["total_calls"] += 1
                        state.nebius_stats["total_latency_ms"] += latency
                        state.nebius_stats["avg_latency_ms"] = (
                            state.nebius_stats["total_latency_ms"]
                            / state.nebius_stats["total_calls"]
                        )
                        state.nebius_stats["total_tokens_estimated"] += max(
                            (
                                getattr(resp.usage, "total_tokens", 0)
                                if resp.usage
                                else 0
                            ),
                            len(content.split()) * 2,
                        )
                        state.nebius_stats["last_call_at"] = time.time()
                        await ws.send_json(
                            {
                                "description": content,
                                "reasoning": f"Analyzed by {nebius_model}",
                                "latency_ms": round(latency, 1),
                            }
                        )
                    except asyncio.TimeoutError:
                        state.nebius_stats["errors"] += 1
                        await ws.send_json(
                            {
                                "description": "VLM reasoning timed out.",
                                "reasoning": "Timeout after 10s",
                                "latency_ms": round((time.time() - t0) * 1000, 1),
                            }
                        )
                    except Exception as e:
                        state.nebius_stats["errors"] += 1
                        logger.error("VLM error: %s", e)
                        await ws.send_json(
                            {
                                "description": "VLM reasoning failed.",
                                "reasoning": "",
                                "latency_ms": round((time.time() - t0) * 1000, 1),
                            }
                        )

            except WebSocketDisconnect:
                pass

    return router
