"""Periodic background sweep that marks devices offline after missed heartbeats.

Started from the control plane's FastAPI lifespan (see ``create_fleet_app``).
Interval comes from ``FLEET_OFFLINE_SWEEP_INTERVAL`` (seconds, default 30);
``0`` or a negative value disables the sweeper.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

DEFAULT_SWEEP_INTERVAL_SECONDS = 30.0
SWEEP_INTERVAL_ENV = "FLEET_OFFLINE_SWEEP_INTERVAL"


def sweep_interval_from_env() -> float:
    """Return the configured sweep interval in seconds (<= 0 means disabled)."""
    raw = os.environ.get(SWEEP_INTERVAL_ENV, "").strip()
    if not raw:
        return DEFAULT_SWEEP_INTERVAL_SECONDS
    try:
        return float(raw)
    except ValueError:
        logger.warning(
            "Invalid %s=%r; using default %ss",
            SWEEP_INTERVAL_ENV,
            raw,
            DEFAULT_SWEEP_INTERVAL_SECONDS,
        )
        return DEFAULT_SWEEP_INTERVAL_SECONDS


def sweep_once(db_factory: Callable[[], Any]) -> list[str]:
    """Run one offline-detection pass across all users. Returns offlined IDs."""
    from .services.heartbeat_service import HeartbeatService

    return HeartbeatService(db_factory()).detect_offline_devices()


async def run_offline_sweeper(
    interval: float,
    db_factory: Optional[Callable[[], Any]] = None,
) -> None:
    """Loop forever, sweeping every ``interval`` seconds, until cancelled.

    Errors in a single pass are logged and the loop continues; a missing
    ``DATABASE_URL`` stops the sweeper (there is nothing to sweep).
    """
    if db_factory is None:
        from .db import get_database

        db_factory = get_database

    logger.info("Offline-device sweeper running every %ss", interval)
    while True:
        try:
            # Database client is synchronous (psycopg pool) — keep it off the loop.
            ids = await asyncio.to_thread(sweep_once, db_factory)
            if ids:
                logger.info("Offline sweep marked %d device(s) offline", len(ids))
        except asyncio.CancelledError:
            raise
        except RuntimeError as exc:
            if "DATABASE_URL" in str(exc):
                logger.warning("Offline sweeper disabled: %s", exc)
                return
            logger.exception("Offline sweep failed")
        except Exception:
            logger.exception("Offline sweep failed")
        await asyncio.sleep(interval)
