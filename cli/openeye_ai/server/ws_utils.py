"""Shared WebSocket utilities for OpenEye server routes.

Consolidates repeated boilerplate: base64 image decoding, connection
tracking, VLM client construction, ping/pong handling, and the VLM
throttle interval constant.
"""

from __future__ import annotations

import base64
import io
import logging
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, AsyncIterator

from PIL import Image
from starlette.websockets import WebSocket

from openeye_ai.server.metrics import ACTIVE_CONNECTIONS

if TYPE_CHECKING:
    import openai as _openai_mod

    from openeye_ai.server.state import AppState

logger = logging.getLogger(__name__)

# Seconds between throttled VLM calls (used by desktop & agentic routes).
VLM_INTERVAL_S: float = 3.0


# ── Base64 → PIL ─────────────────────────────────────────────────────

def decode_base64_image(data: str) -> Image.Image:
    """Decode a base64-encoded image string to an RGB PIL Image.

    Raises *ValueError* on invalid data.
    """
    try:
        img_bytes = base64.b64decode(data)
        return Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError("Invalid base64 image data") from exc


# ── Connection tracking ──────────────────────────────────────────────

@asynccontextmanager
async def track_connection(ws: WebSocket) -> AsyncIterator[None]:
    """Accept *ws*, increment ACTIVE_CONNECTIONS, and decrement on exit."""
    await ws.accept()
    ACTIVE_CONNECTIONS.inc()
    try:
        yield
    finally:
        ACTIVE_CONNECTIONS.dec()


# ── Ping / pong ──────────────────────────────────────────────────────

async def handle_ping(data: str, ws: WebSocket) -> bool:
    """If *data* is a ping, send pong and return ``True``."""
    if data == "ping":
        await ws.send_text("pong")
        return True
    return False


# ── VLM client factory ──────────────────────────────────────────────

def create_vlm_client(
    state: AppState,
) -> tuple["_openai_mod.AsyncOpenAI | None", str]:
    """Resolve VLM config from *state* and build an AsyncOpenAI client.

    Returns ``(client_or_None, model_id)``.  Also populates
    ``state.nebius_stats`` with provider metadata.
    """
    nebius_key, nebius_base, nebius_model = state.resolve_vlm_model()

    if not nebius_key:
        return None, nebius_model

    state.nebius_stats["configured"] = True
    state.nebius_stats["model"] = nebius_model
    state.nebius_stats["provider"] = (
        "OpenRouter" if "openrouter.ai" in nebius_base else "Nebius Token Factory"
    )

    try:
        import openai

        client = openai.AsyncOpenAI(base_url=nebius_base, api_key=nebius_key)
        return client, nebius_model
    except ImportError:
        logger.warning("openai package not installed — VLM disabled")
        return None, nebius_model
