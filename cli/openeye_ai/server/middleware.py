"""Middleware configuration for the OpenEye server."""

from __future__ import annotations

import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from openeye_ai.server.metrics import REQUEST_COUNT, REQUEST_LATENCY
from openeye_ai.server.rate_limit import limiter


def setup_middleware(app: FastAPI) -> None:
    """Configure rate limiting, CORS, and metrics middleware on the app."""
    # Rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS
    allowed_origins = [
        o.strip()
        for o in os.environ.get(
            "CORS_ORIGINS",
            "https://openeye.sh,https://www.openeye.sh,"
            "http://localhost:5173,http://localhost:3000,http://localhost:8080",
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

    # Chrome's Private Network Access: a public HTTPS page (the openeye.sh
    # dashboard) may only call this local server if the preflight opts in.
    @app.middleware("http")
    async def private_network_access(request: Request, call_next):
        response = await call_next(request)
        if request.headers.get("access-control-request-private-network") == "true":
            response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

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
