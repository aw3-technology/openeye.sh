"""Health, metrics, config, and dashboard routes."""

from __future__ import annotations

import time
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from openeye_ai.server.state import AppState

_DASHBOARD_PATH = Path(__file__).resolve().parents[1] / "dashboard.html"


def create_router(state: AppState) -> APIRouter:
    router = APIRouter()

    @router.get("/", response_class=HTMLResponse)
    async def dashboard():
        return _DASHBOARD_PATH.read_text()

    @router.get("/health")
    async def health():
        return {
            "status": "ok",
            "model": state.model_name,
            "model_loaded": (
                state.adapter._loaded
                if hasattr(state.adapter, "_loaded")
                else True
            ),
            "uptime_seconds": round(time.time() - state.start_time, 1),
        }

    @router.get("/metrics")
    async def metrics():
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST,
        )

    @router.get("/queue/status")
    async def queue_status():
        return {
            "active": state.inference_queue.active_count,
            "queued": state.inference_queue.queue_size,
        }

    @router.get("/nebius/stats")
    async def nebius_stats():
        """Return Nebius Token Factory VLM usage statistics."""
        stats = dict(state.nebius_stats)
        stats["uptime_seconds"] = round(time.time() - state.start_time, 1)
        return JSONResponse(stats)

    @router.get("/config")
    async def get_config():
        return JSONResponse(state.runtime_config)

    @router.put("/config")
    async def put_config(request: Request):
        config = await request.json()
        state.runtime_config.clear()
        state.runtime_config.update(config)
        return {"status": "ok"}

    return router
