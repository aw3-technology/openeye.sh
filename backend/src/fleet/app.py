"""Fleet control plane – FastAPI application factory."""

import asyncio
import logging
import os
import time
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routers import alerts, commands, deployments, device_groups, devices, heartbeats, maintenance, ota, v1_api

logger = logging.getLogger(__name__)

_DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://localhost:3000"

# Simple in-memory sliding-window rate limiter for fleet endpoints
_rate_buckets: dict[str, list[float]] = defaultdict(list)
_rate_lock = asyncio.Lock()
_FLEET_RATE_LIMIT = 120  # requests per window
_FLEET_RATE_WINDOW = 60  # seconds


def create_fleet_app() -> FastAPI:
    """Create and return the Fleet Management FastAPI application."""
    app = FastAPI(
        title="OpenEye Fleet Control Plane",
        description="Manage edge AI devices, staged deployments, OTA updates, and fleet health.",
        version="0.1.0",
    )

    allowed_origins = [
        o.strip()
        for o in os.environ.get("CORS_ORIGINS", _DEFAULT_CORS_ORIGINS).split(",")
        if o.strip()
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Device-API-Key"],
    )

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        # Skip for health checks and v1 API (has its own rate limiter)
        if request.url.path == "/health" or request.url.path.startswith("/v1"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"fleet:{client_ip}"
        now = time.monotonic()

        async with _rate_lock:
            bucket = _rate_buckets[key]
            cutoff = now - _FLEET_RATE_WINDOW
            _rate_buckets[key] = bucket = [t for t in bucket if t > cutoff]
            # Prune empty buckets to prevent memory leak from many distinct IPs
            if not bucket:
                del _rate_buckets[key]
                return await call_next(request)

            if len(bucket) >= _FLEET_RATE_LIMIT:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Try again later."},
                    headers={"Retry-After": str(_FLEET_RATE_WINDOW)},
                )

            bucket.append(now)
        return await call_next(request)

    # Mount routers
    app.include_router(devices.router, prefix="/devices", tags=["Devices"])
    app.include_router(heartbeats.router, prefix="/heartbeats", tags=["Heartbeats"])
    app.include_router(deployments.router, prefix="/deployments", tags=["Deployments"])
    app.include_router(device_groups.router, prefix="/groups", tags=["Device Groups"])
    app.include_router(maintenance.router, prefix="/maintenance", tags=["Maintenance"])
    app.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
    app.include_router(ota.router, prefix="/ota", tags=["OTA"])
    app.include_router(commands.router, prefix="/commands", tags=["Commands"])
    app.include_router(v1_api.router, prefix="/v1", tags=["Hosted API"])

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "fleet-control-plane"}

    @app.on_event("shutdown")
    async def shutdown_services():
        from .routers.v1_api import _credits_svc
        from .routers.v1_stream import _credits_svc as _stream_credits_svc
        await _credits_svc.close()
        await _stream_credits_svc.close()

    logger.info("Fleet control plane app created")
    return app
