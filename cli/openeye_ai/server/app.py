"""FastAPI app factory — mounts routers + middleware."""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import FastAPI

from openeye_ai.server.metrics import MODEL_INFO
from openeye_ai.server.middleware import setup_middleware
from openeye_ai.server.queue import InferenceQueue
from openeye_ai.server.routes.rest import router as rest_router
from openeye_ai.server.routes.v1 import router as v1_router
from openeye_ai.server.routes.websockets import router as ws_router
from openeye_ai.server.routes.ws_vlm import router as ws_vlm_router
from openeye_ai.server.state import ServerState

logger = logging.getLogger(__name__)


def create_app(
    adapter,
    model_name: str,
    model_info: dict[str, Any],
    vlm_model: str | None = None,
    cortex_llm: str | None = None,
) -> FastAPI:
    app = FastAPI(title=f"OpenEye — {model_info['name']}", version="0.1.0")

    # Build runtime config from CLI flags
    runtime_config: dict[str, Any] = {}
    if vlm_model:
        runtime_config["vlm_model"] = vlm_model
    if cortex_llm:
        runtime_config["cortex_llm"] = cortex_llm

    # Shared server state
    state = ServerState(
        adapter=adapter,
        model_name=model_name,
        model_info=model_info,
        inference_queue=InferenceQueue(max_concurrent=1, max_queue_size=16),
        runtime_config=runtime_config,
        start_time=time.time(),
    )

    # Try to mount governance router and wire up set_engine
    try:
        from governance.router import router as governance_router, set_engine as set_governance_engine

        app.include_router(governance_router)
        state._set_governance_engine = set_governance_engine
    except ImportError:
        logger.info("Governance router not available")

    app.state.server = state

    # Middleware (CORS, rate-limiting, metrics)
    setup_middleware(app)

    # Mount routers
    app.include_router(rest_router)
    app.include_router(v1_router)
    app.include_router(ws_router)
    app.include_router(ws_vlm_router)

    # Mount MLOps router
    from openeye_ai.mlops.api import router as mlops_router

    app.include_router(mlops_router)

    # Mount Agent router
    from openeye_ai.server.agent_router import router as agent_router

    app.include_router(agent_router)

    # Set model info metric
    MODEL_INFO.info({"model": model_name, "task": model_info["task"]})

    return app
