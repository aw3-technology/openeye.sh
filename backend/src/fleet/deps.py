"""FastAPI dependency injection for fleet control plane."""

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, List, Optional
from urllib.parse import unquote

from fastapi import Depends, Header, HTTPException, status
from fastapi.requests import HTTPConnection

from .db import Database, get_database
from .services.credits_service import CreditsService, db_email_lookup
from .services.inference_service import InferenceService

logger = logging.getLogger(__name__)


# ── API Key Auth Context ──────────────────────────────────────


@dataclass
class ApiKeyContext:
    """Context returned by get_api_key_auth for hosted API endpoints."""

    user_id: str
    api_key_id: str
    key_prefix: str
    scopes: List[str] = field(default_factory=lambda: ["inference"])
    rate_limit: int = 60


# ── Database ──────────────────────────────────────────────────


def get_db() -> Database:
    """Return the shared Neon Postgres client (lazily initialised from DATABASE_URL).

    There is no row-level security: every query MUST include an explicit
    user_id (or device_id) filter to prevent cross-user data access.
    """
    return get_database()


# ── Better Auth sessions ──────────────────────────────────────


_SESSION_SQL = (
    'select s."userId" as user_id from "session" s '
    'where s."token" = any(%s) and s."expiresAt" > now() '
    "limit 1"
)


def session_token_candidates(raw: str) -> list[str]:
    """Tokens to try for a bearer value.

    Better Auth's session cookie value is ``<token>.<signature>`` (URL-encoded);
    the ``session.token`` column holds only ``<token>``. Accept either form.
    """
    value = unquote(raw.strip())
    if not value:
        return []
    candidates = [value]
    if "." in value:
        head = value.split(".", 1)[0]
        if head:
            candidates.append(head)
    return candidates


def resolve_session_user_id(db: Any, token: str) -> Optional[str]:
    """Return the Better Auth user id for a live session token, else None."""
    candidates = session_token_candidates(token)
    if not candidates:
        return None
    rows = db.query(_SESSION_SQL, [candidates])
    if rows:
        return rows[0]["user_id"]
    return None


async def get_current_user_id(
    authorization: str = Header(..., description="Bearer <better-auth-session-token>"),
    db: Database = Depends(get_db),
) -> str:
    """Resolve the user id from a Better Auth session token (Authorization: Bearer)."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth header"
        )
    token = authorization[7:]
    try:
        user_id = resolve_session_user_id(db, token)
    except Exception as exc:
        logger.warning("Session lookup failed: %s", exc)
        user_id = None
    if user_id:
        return user_id
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session"
    )


# ── Device keys ───────────────────────────────────────────────


async def get_device_api_key(
    x_device_api_key: str = Header(..., alias="X-Device-API-Key"),
    db: Database = Depends(get_db),
) -> str:
    """Authenticate a device via its API key. Returns the device ID."""
    key_hash = hashlib.sha256(x_device_api_key.encode()).hexdigest()
    result = (
        db.table("devices")
        .select("id, status")
        .eq("api_key_hash", key_hash)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device API key"
        )
    device = result.data[0]
    if device.get("status") == "decommissioned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device has been decommissioned",
        )
    return device["id"]


# ── User API keys (oe_xxx) ────────────────────────────────────


def lookup_api_key(db: Any, raw_key: str) -> Optional[ApiKeyContext]:
    """Resolve a raw ``oe_`` key to its context, or None if unknown."""
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    result = (
        db.table("api_keys")
        .select("id, user_id, key_prefix, scopes, rate_limit")
        .eq("key_hash", key_hash)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    row = result.data[0]
    return ApiKeyContext(
        user_id=row["user_id"],
        api_key_id=row["id"],
        key_prefix=row["key_prefix"],
        scopes=row.get("scopes") or ["inference"],
        rate_limit=row.get("rate_limit") or 60,
    )


async def get_api_key_auth(
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    db: Database = Depends(get_db),
) -> ApiKeyContext:
    """Authenticate a user API key (oe_xxx) for hosted inference endpoints.

    Accepts either ``Authorization: Bearer oe_xxx`` or ``X-API-Key: oe_xxx``.
    Verifies the SHA-256 hash against the ``api_keys`` table and updates
    ``last_used_at``.
    """
    raw_key: Optional[str] = None
    if x_api_key and x_api_key.startswith("oe_"):
        raw_key = x_api_key
    elif authorization and authorization.startswith("Bearer oe_"):
        raw_key = authorization[7:]

    if not raw_key or len(raw_key) < 10 or len(raw_key) > 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Missing or invalid API key. Provide Authorization: Bearer oe_xxx "
                "or X-API-Key header."
            ),
        )

    ctx = lookup_api_key(db, raw_key)
    if ctx is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )

    # Best-effort last_used_at bump; never fail the request over it.
    try:
        db.table("api_keys").update(
            {"last_used_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", ctx.api_key_id).execute()
    except Exception:
        logger.debug("Failed to update last_used_at for key %s", ctx.key_prefix)

    return ctx


# ── Long-lived services ───────────────────────────────────────

_fallback_credits: Optional[CreditsService] = None
_fallback_inference: Optional[InferenceService] = None


def _registry_get(request: HTTPConnection, name: str, expected: type) -> Any:
    registry = getattr(request.app.state, "registry", None)
    if registry is None:
        return None
    try:
        return registry.get(name, expected)
    except (KeyError, TypeError):
        return None


def get_credits_service(request: HTTPConnection) -> CreditsService:
    """Shared CreditsService (from the app's resource registry when present)."""
    svc = _registry_get(request, "credits_service", CreditsService)
    if svc is not None:
        return svc
    global _fallback_credits
    if _fallback_credits is None:
        _fallback_credits = CreditsService(email_lookup=_user_email)
    return _fallback_credits


def _user_email(user_id: str) -> Optional[str]:
    """Look up a Better Auth user's email (Cred identifies users by email)."""
    return db_email_lookup(get_database())(user_id)


def get_inference_service(request: HTTPConnection) -> InferenceService:
    """Shared InferenceService (from the app's resource registry when present)."""
    svc = _registry_get(request, "inference_service", InferenceService)
    if svc is not None:
        return svc
    global _fallback_inference
    if _fallback_inference is None:
        _fallback_inference = InferenceService()
    return _fallback_inference


async def close_fallback_services() -> None:
    global _fallback_credits
    if _fallback_credits is not None:
        await _fallback_credits.close()
        _fallback_credits = None
