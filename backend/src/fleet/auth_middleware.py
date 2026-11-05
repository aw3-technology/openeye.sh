"""Unified auth middleware for fleet control plane routes.

Supports multiple authentication strategies (Better Auth session, user API
key) and provides a unified AuthContext for route handlers.
"""

import logging
from dataclasses import dataclass, field
from typing import Callable, Optional

from fastapi import Depends, Header, HTTPException, status

from .deps import ApiKeyContext, get_api_key_auth, get_db, resolve_session_user_id

logger = logging.getLogger(__name__)


@dataclass
class AuthContext:
    """Unified authentication context returned by auth dependencies."""

    user_id: str
    # "jwt" is kept as the value for user-session auth so existing checks keep
    # working; it now means a Better Auth session token.
    auth_method: str  # "jwt" | "api_key" | "device_key"
    api_key_id: Optional[str] = None
    scopes: list[str] = field(default_factory=lambda: ["*"])


def _session_user(db, token: str) -> Optional[str]:
    try:
        return resolve_session_user_id(db, token)
    except Exception as exc:
        logger.warning("Session lookup failed: %s", exc)
        return None


async def require_auth(
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    db=Depends(get_db),
) -> AuthContext:
    """Try session auth first, then API key auth. Returns a unified AuthContext.

    Accepts:
    - Authorization: Bearer <better-auth-session-token>  (session auth)
    - Authorization: Bearer oe_xxx  or  X-API-Key: oe_xxx  (API key auth)
    """
    # 1. Session auth for a Bearer token that isn't an API key
    if (
        authorization
        and authorization.startswith("Bearer ")
        and not authorization.startswith("Bearer oe_")
    ):
        user_id = _session_user(db, authorization[7:])
        if user_id:
            return AuthContext(user_id=user_id, auth_method="jwt")

    # 2. API key auth (a 401 from key validation propagates)
    if (x_api_key and x_api_key.startswith("oe_")) or (
        authorization and authorization.startswith("Bearer oe_")
    ):
        api_ctx: ApiKeyContext = await get_api_key_auth(
            authorization=authorization, x_api_key=x_api_key, db=db
        )
        return AuthContext(
            user_id=api_ctx.user_id,
            auth_method="api_key",
            api_key_id=api_ctx.api_key_id,
            scopes=api_ctx.scopes,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide a valid session token or API key.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def require_jwt_auth(
    authorization: str = Header(..., description="Bearer <better-auth-session-token>"),
    db=Depends(get_db),
) -> AuthContext:
    """Require session authentication specifically (admin/destructive operations)."""
    if not authorization.startswith("Bearer ") or authorization.startswith(
        "Bearer oe_"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This operation requires session authentication.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = _session_user(db, authorization[7:])
    if user_id:
        return AuthContext(user_id=user_id, auth_method="jwt")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_scope(scope: str) -> Callable:
    """Dependency factory that checks if the auth context includes a required scope."""

    async def _check_scope(auth: AuthContext = Depends(require_auth)) -> AuthContext:
        if "*" in auth.scopes or scope in auth.scopes:
            return auth
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient scope. Required: {scope}",
        )

    return _check_scope
