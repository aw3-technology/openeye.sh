from __future__ import annotations

import os

from fastapi import Header


def _valid_api_key(
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None),
) -> str:
    """Validate the API key from ``Authorization: Bearer oe_...`` or ``X-API-Key``.

    Mirrors the hosted API: a Bearer token wins when present, otherwise the
    ``X-API-Key`` header is used.  In production this would hit a key store;
    here we accept any key that starts with ``oe_`` — or, when
    ``OPENEYE_SERVER_API_KEY`` is set on the server side, only that exact key.
    """
    token = ""
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer":
            token = value.strip()
    if not token and x_api_key:
        token = x_api_key.strip()
    if not token:
        raise _auth_error(
            "Missing API key (use 'Authorization: Bearer oe_...' or 'X-API-Key')"
        )
    server_key = os.environ.get("OPENEYE_SERVER_API_KEY", "")
    if server_key:
        if token == server_key:
            return token
        raise _auth_error("Invalid API key")
    if not token.startswith("oe_"):
        raise _auth_error("API key must start with oe_")
    return token


def _auth_error(detail: str):
    from fastapi import HTTPException

    return HTTPException(status_code=401, detail=detail)
