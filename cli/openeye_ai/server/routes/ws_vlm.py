"""WebSocket route for VLM (Vision Language Model) endpoint."""

from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from openeye_ai.server.metrics import ACTIVE_CONNECTIONS
from openeye_ai.server.state import get_state, nebius_stats
from openeye_ai.vlm import create_async_vlm_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/vlm")
async def websocket_vlm(ws: WebSocket):
    await ws.accept()
    ACTIVE_CONNECTIONS.inc()
    state = get_state(ws)

    nebius_key, nebius_base, nebius_model = state.resolve_vlm_model()

    vlm_client, _ = create_async_vlm_client(nebius_key, nebius_base, nebius_model)
    if vlm_client:
        nebius_stats["configured"] = True
        nebius_stats["model"] = nebius_model
        nebius_stats["provider"] = "OpenRouter" if "openrouter.ai" in nebius_base else "Nebius Token Factory"

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
