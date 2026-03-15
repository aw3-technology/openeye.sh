"""FastAPI app factory — REST + WebSocket + browser dashboard."""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from openeye_ai.server.metrics import MODEL_INFO, REQUEST_COUNT, REQUEST_LATENCY
from openeye_ai.server.rate_limit import limiter
from openeye_ai.server.routes.agentic import create_router as agentic_router
from openeye_ai.server.routes.debug import create_router as debug_router
from openeye_ai.server.routes.desktop import create_router as desktop_router
from openeye_ai.server.routes.health import create_router as health_router
from openeye_ai.server.routes.perception import create_router as perception_router
from openeye_ai.server.routes.predict import create_router as predict_router
from openeye_ai.server.routes.vlm import create_router as vlm_router
from openeye_ai.server.state import AppState

logger = logging.getLogger(__name__)


def create_app(
    adapter,
    model_name: str,
    model_info: dict[str, Any],
    vlm_model: str | None = None,
    cortex_llm: str | None = None,
) -> FastAPI:
    app = FastAPI(title=f"OpenEye — {model_info['name']}", version="0.1.0")

    # Shared state
    state = AppState(adapter, model_name, model_info, vlm_model, cortex_llm)

    # Rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS
    allowed_origins = [
        o.strip()
        for o in os.environ.get(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
        ).split(",")
        if o.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    )

    # Metrics middleware
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

    # Set model info metric
    MODEL_INFO.info({"model": model_name, "task": model_info["task"]})

    # --- Mount route modules ---
    app.include_router(health_router(state))
    app.include_router(predict_router(state))
    app.include_router(perception_router(state))
    app.include_router(vlm_router(state))
    app.include_router(agentic_router(state))
    app.include_router(debug_router(state))
    app.include_router(desktop_router(state))

    # --- Mount external routers ---
    from openeye_ai.mlops.api import router as mlops_router

    app.include_router(mlops_router)

    from openeye_ai.server.agent_router import router as agent_router

    app.include_router(agent_router)

    try:
        from governance.router import (
            router as governance_router,
            set_engine as set_governance_engine,
        )

        app.include_router(governance_router)
        # Wire governance engine if config is set
        gov = state._init_governance()
        if gov is not None:
            set_governance_engine(gov)
    except ImportError:
        logger.info("Governance router not available")

    return app
