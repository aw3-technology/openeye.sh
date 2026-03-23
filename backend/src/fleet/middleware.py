"""Observability middleware for the Fleet control plane."""

import time
import uuid
from contextvars import ContextVar

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# Context variable that structlog's merge_contextvars processor reads automatically
correlation_id_ctx: ContextVar[str | None] = ContextVar("correlation_id", default=None)

_HEADER = "X-Request-ID"

logger = structlog.stdlib.get_logger("fleet.middleware")


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Read or generate a correlation ID and expose it via contextvars + response header."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get(_HEADER) or str(uuid.uuid4())
        correlation_id_ctx.set(request_id)
        # Bind into structlog contextvars so every log in this request carries it
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(correlation_id=request_id)

        response = await call_next(request)
        response.headers[_HEADER] = request_id
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every HTTP request with method, path, status, and duration."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        logger.info(
            "request_handled",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            correlation_id=correlation_id_ctx.get(""),
        )
        return response
