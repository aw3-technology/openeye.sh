"""FastAPI dependency injection for fleet control plane."""

import hashlib
import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional

from fastapi import Depends, Header, HTTPException, status
from supabase import Client, create_client

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

_supabase_client: Optional[Client] = None


def get_supabase() -> Client:
    """Return a shared Supabase client (lazily initialised).

    WARNING: This client uses the service role key which bypasses Row Level Security.
    Every query MUST include an explicit user_id (or device_id) filter to prevent
    cross-user data access. Never rely on RLS alone when using this client.
    """
    global _supabase_client
    if _supabase_client is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_KEY", ""))
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _supabase_client = create_client(url, key)
    return _supabase_client


async def get_current_user_id(
    authorization: str = Header(..., description="Bearer <supabase-jwt>"),
    sb: Client = Depends(get_supabase),
) -> str:
    """Extract and verify user ID from a Supabase JWT in the Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth header")
    token = authorization[7:]
    try:
        user = sb.auth.get_user(token)
        if user and user.user:
            return user.user.id
    except Exception as exc:
        logger.warning("JWT verification failed: %s", exc)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


async def get_device_api_key(
    x_device_api_key: str = Header(..., alias="X-Device-API-Key"),
    sb: Client = Depends(get_supabase),
) -> str:
    """Authenticate a device via its API key. Returns the device ID."""
    key_hash = hashlib.sha256(x_device_api_key.encode()).hexdigest()
    result = (
        sb.table("devices")
        .select("id, status")
        .eq("api_key_hash", key_hash)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device API key")
    device = result.data[0]
    if device.get("status") == "decommissioned":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Device has been decommissioned")
    return device["id"]


async def get_api_key_auth(
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    sb: Client = Depends(get_supabase),
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
            detail="Missing or invalid API key. Provide Authorization: Bearer oe_xxx or X-API-Key header.",
        )

    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    result = (
        sb.table("api_keys")
        .select("id, user_id, key_prefix, scopes, rate_limit")
        .eq("key_hash", key_hash)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )

    row = result.data[0]

    # Update last_used_at (fire-and-forget, don't block the request)
    try:
        from datetime import datetime, timezone
        sb.table("api_keys").update({"last_used_at": datetime.now(timezone.utc).isoformat()}).eq("id", row["id"]).execute()
    except Exception:
        logger.debug("Failed to update last_used_at for key %s", row["key_prefix"])

    return ApiKeyContext(
        user_id=row["user_id"],
        api_key_id=row["id"],
        key_prefix=row["key_prefix"],
        scopes=row.get("scopes") or ["inference"],
        rate_limit=row.get("rate_limit") or 60,
    )
