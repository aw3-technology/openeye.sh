"""Unified exception handlers for the Fleet control plane API."""

import logging
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def _correlation_id(request: Request) -> str | None:
    """Extract or generate a correlation ID for error tracing."""
    # Check request state first (set by middleware), then fall back to header
    cid: str | None = getattr(request.state, "correlation_id", None)
    if not cid:
        cid = request.headers.get("X-Correlation-ID") or request.headers.get("X-Request-ID")
    return cid


def _error_body(
    *,
    error: str,
    message: str,
    status_code: int,
    correlation_id: str | None = None,
    details: Any = None,
) -> dict:
    body: dict[str, Any] = {
        "error": error,
        "message": message,
        "status_code": status_code,
        "correlation_id": correlation_id,
    }
    if details is not None:
        body["details"] = details
    return body


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    cid = _correlation_id(request)
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(
            error=type(exc).__name__,
            message=str(exc.detail),
            status_code=exc.status_code,
            correlation_id=cid,
        ),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    cid = _correlation_id(request)
    field_errors = []
    for err in exc.errors():
        field_errors.append({
            "loc": list(err.get("loc", [])),
            "msg": err.get("msg", ""),
            "type": err.get("type", ""),
        })

    return JSONResponse(
        status_code=422,
        content=_error_body(
            error="ValidationError",
            message="Request validation failed",
            status_code=422,
            correlation_id=cid,
            details=field_errors,
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    cid = _correlation_id(request) or str(uuid.uuid4())
    logger.exception(
        "Unhandled exception [correlation_id=%s] %s %s",
        cid,
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content=_error_body(
            error="InternalServerError",
            message="An internal error occurred. Please try again later.",
            status_code=500,
            correlation_id=cid,
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers on the given FastAPI app."""
    app.add_exception_handler(HTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_exception_handler)  # type: ignore[arg-type]
