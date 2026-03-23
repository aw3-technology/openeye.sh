"""Explicit lifecycle management for long-running resources.

Provides a ``ResourceRegistry`` that owns named resources and tears them
down cleanly on application shutdown, plus a FastAPI ``lifespan`` context
manager that wires everything together.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any, Protocol, TypeVar, runtime_checkable

from fastapi import FastAPI

logger = logging.getLogger(__name__)

T = TypeVar("T")


# ── AsyncResource protocol ──────────────────────────────────────


@runtime_checkable
class AsyncResource(Protocol):
    """Any object that exposes an async ``close`` for cleanup."""

    async def close(self) -> None: ...


# ── ResourceRegistry ────────────────────────────────────────────


class ResourceRegistry:
    """Named bag of long-lived resources with ordered teardown.

    Not a singleton — the running ``FastAPI`` app owns the sole instance
    via ``app.state.registry``.
    """

    def __init__(self) -> None:
        self._resources: dict[str, Any] = {}
        # Track insertion order so close_all can tear down in reverse
        self._order: list[str] = []

    def register(self, name: str, resource: Any) -> None:
        """Store *resource* under *name*, replacing any previous entry."""
        if name in self._resources:
            logger.warning("Replacing already-registered resource %r", name)
        else:
            self._order.append(name)
        self._resources[name] = resource

    def get(self, name: str, expected_type: type[T]) -> T:
        """Retrieve a resource by name, checking its type at runtime."""
        resource = self._resources.get(name)
        if resource is None:
            raise KeyError(f"No resource registered under {name!r}")
        if not isinstance(resource, expected_type):
            raise TypeError(
                f"Resource {name!r} is {type(resource).__name__}, "
                f"expected {expected_type.__name__}"
            )
        return resource

    async def close_all(self) -> None:
        """Close every resource that supports it, in reverse registration order."""
        for name in reversed(self._order):
            resource = self._resources.get(name)
            if resource is None:
                continue
            if isinstance(resource, AsyncResource):
                try:
                    await resource.close()
                    logger.info("Closed resource %r", name)
                except Exception:
                    logger.exception("Error closing resource %r", name)
        self._resources.clear()
        self._order.clear()


# ── FastAPI lifespan ────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: create shared services, tear them down on exit."""
    from .deps import get_supabase
    from .services.credits_service import CreditsService
    from .services.inference_service import InferenceService

    registry = ResourceRegistry()

    # Supabase client (sync client — no async close needed, but register for
    # discoverability)
    sb = get_supabase()
    registry.register("supabase", sb)

    # Long-lived HTTP-backed services
    credits_svc = CreditsService()
    registry.register("credits_service", credits_svc)

    inference_svc = InferenceService()
    registry.register("inference_service", inference_svc)

    app.state.registry = registry
    logger.info("Resource registry initialised with %d resources", len(registry._resources))

    yield

    await registry.close_all()
    logger.info("Resource registry shut down")
