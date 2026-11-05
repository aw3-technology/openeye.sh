"""Fleet control plane – FastAPI application factory."""

import asyncio
import contextlib
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

import psycopg
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routers import (
    alerts,
    commands,
    deployments,
    device_groups,
    devices,
    heartbeats,
    maintenance,
    ota,
    v1_api,
)
from .offline_sweeper import run_offline_sweeper, sweep_interval_from_env

logger = logging.getLogger(__name__)

_DEFAULT_CORS_ORIGINS = ",".join(
    [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",  # dashboard dev server (`npm run dev`)
        "https://openeye.sh",
        "https://www.openeye.sh",
    ]
)

# Simple in-memory sliding-window rate limiter for fleet endpoints
_FLEET_RATE_LIMIT = 120  # requests per window, per client IP
_FLEET_RATE_WINDOW = 60  # seconds
_RATE_BUCKET_PRUNE_THRESHOLD = 10_000  # distinct IPs before stale keys are pruned


def create_fleet_app(
    *,
    rate_limit: Optional[int] = None,
    rate_window: Optional[float] = None,
    offline_sweep_interval: Optional[float] = None,
) -> FastAPI:
    """Create and return the Fleet Management FastAPI application.

    Args:
        rate_limit: Requests per window per client IP (default 120, or
            ``FLEET_RATE_LIMIT``).
        rate_window: Rate-limit window in seconds (default 60).
        offline_sweep_interval: Seconds between offline-device sweeps; ``<= 0``
            disables the sweeper. Defaults to ``FLEET_OFFLINE_SWEEP_INTERVAL``
            (30s when unset).
    """
    limit = (
        rate_limit
        if rate_limit is not None
        else int(os.environ.get("FLEET_RATE_LIMIT", _FLEET_RATE_LIMIT))
    )
    window = rate_window if rate_window is not None else _FLEET_RATE_WINDOW
    sweep_interval = (
        offline_sweep_interval
        if offline_sweep_interval is not None
        else sweep_interval_from_env()
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        sweeper: Optional[asyncio.Task] = None
        if sweep_interval > 0:
            sweeper = asyncio.create_task(
                run_offline_sweeper(sweep_interval), name="fleet-offline-sweeper"
            )
        app.state.offline_sweeper = sweeper
        try:
            yield
        finally:
            if sweeper is not None:
                sweeper.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await sweeper
            from .db import close_database
            from .deps import close_fallback_services

            await close_fallback_services()
            close_database()

    app = FastAPI(
        title="OpenEye Fleet Control Plane",
        description="Manage edge AI devices, staged deployments, OTA updates, and fleet health.",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Per-app limiter state (so separate apps, e.g. in tests, don't share buckets)
    rate_buckets: dict[str, list[float]] = {}
    rate_lock = asyncio.Lock()

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        # Skip for health checks and v1 API (has its own rate limiter)
        if request.url.path == "/health" or request.url.path.startswith("/v1"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"fleet:{client_ip}"
        now = time.monotonic()
        cutoff = now - window

        async with rate_lock:
            bucket = [t for t in rate_buckets.get(key, ()) if t > cutoff]
            if len(bucket) >= limit:
                rate_buckets[key] = bucket
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Try again later."},
                    headers={"Retry-After": str(int(window))},
                )
            bucket.append(now)
            rate_buckets[key] = bucket
            # Bound memory under many distinct IPs: drop keys with no recent hits
            if len(rate_buckets) > _RATE_BUCKET_PRUNE_THRESHOLD:
                for k in [k for k, b in rate_buckets.items() if b[-1] <= cutoff]:
                    del rate_buckets[k]
        return await call_next(request)

    allowed_origins = [
        o.strip()
        for o in os.environ.get("CORS_ORIGINS", _DEFAULT_CORS_ORIGINS).split(",")
        if o.strip()
    ]

    # Added after the rate limiter so CORS is the outermost layer: 429s still
    # carry CORS headers and preflights are answered without being counted.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-API-Key",
            "X-Device-API-Key",
        ],
    )

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

    @app.exception_handler(psycopg.errors.DataError)
    async def _db_data_error(request: Request, exc: psycopg.errors.DataError):
        # e.g. a malformed UUID in a path/body ("invalid input syntax for type uuid")
        logger.info("Rejected bad value on %s: %s", request.url.path, exc)
        return JSONResponse(
            status_code=400, content={"detail": "Invalid identifier or value"}
        )

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "fleet-control-plane"}

    logger.info("Fleet control plane app created")
    return app
