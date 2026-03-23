"""WebSocket routes for the OpenEye server."""

from __future__ import annotations

from fastapi import APIRouter

from openeye_ai.server.routes.ws_agentic import websocket_agentic
from openeye_ai.server.routes.ws_perception import websocket_perception
from openeye_ai.server.routes.ws_predict import websocket_predict

router = APIRouter()

router.websocket("/ws")(websocket_predict)
router.websocket("/ws/perception")(websocket_perception)
router.websocket("/ws/agentic")(websocket_agentic)
