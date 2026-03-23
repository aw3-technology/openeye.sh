"""Unified auth middleware for fleet control plane routes.

Supports multiple authentication strategies (JWT, API key, device key)
and provides a unified AuthContext for route handlers.
"""

import logging
from dataclasses import dataclass, field
from typing import Callable, Optional

from fastapi import Depends, Header, HTTPException, status

from .deps import ApiKeyContext, get_api_key_auth, get_supabase

logger = logging.getLogger(__name__)


@dataclass
class AuthContext:
    """Unified authentication context returned by auth dependencies."""

    user_id: str
    auth_method: str  # "jwt" | "api_key" | "device_key"
    api_key_id: Optional[str] = None
    scopes: list[str] = field(default_factory=lambda: ["*"])


async def require_auth(
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    sb=Depends(get_supabase),
) -> AuthContext:
    """Try JWT auth first, then API key auth. Returns a unified AuthContext.

    Accepts:
    - Authorization: Bearer <supabase-jwt>  (JWT auth)
    - Authorization: Bearer oe_xxx  or  X-API-Key: oe_xxx  (API key auth)
    """
    # 1. Try JWT auth if we have a Bearer token that isn't an API key
    if authorization and authorization.startswith("Bearer ") and not authorization.startswith("Bearer oe_"):
        token = authorization[7:]
        try:
            user = sb.auth.get_user(token)
            if user and user.user:
                return AuthContext(
                    user_id=user.user.id,
                    auth_method="jwt",
                )
        except Exception as exc:
            logger.debug("JWT auth attempt failed: %s", exc)

    # 2. Try API key auth
    if x_api_key and x_api_key.startswith("oe_") or (
        authorization and authorization.startswith("Bearer oe_")
    ):
        try:
            api_ctx: ApiKeyContext = await get_api_key_auth(
                authorization=authorization, x_api_key=x_api_key, sb=sb
            )
            return AuthContext(
                user_id=api_ctx.user_id,
                auth_method="api_key",
                api_key_id=api_ctx.api_key_id,
                scopes=api_ctx.scopes,
            )
        except HTTPException:
            raise  # Re-raise 401 from API key validation

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide a valid JWT or API key.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def require_jwt_auth(
    authorization: str = Header(..., description="Bearer <supabase-jwt>"),
    sb=Depends(get_supabase),
) -> AuthContext:
    """Require JWT authentication specifically (for admin/destructive operations)."""
    if not authorization.startswith("Bearer ") or authorization.startswith("Bearer oe_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This operation requires JWT authentication.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[7:]
    try:
        user = sb.auth.get_user(token)
        if user and user.user:
            return AuthContext(
                user_id=user.user.id,
                auth_method="jwt",
            )
    except Exception as exc:
        logger.warning("JWT verification failed: %s", exc)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired JWT token.",
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
