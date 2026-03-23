from __future__ import annotations

import os

from fastapi import Header


def _valid_api_key(authorization: str = Header(...)) -> str:
    """Validate ``Authorization: Bearer oe_...`` header.

    In production this would hit a key store; here we accept any key that
    starts with ``oe_`` (or matches ``OPENEYE_API_KEY`` when set on the
    server side).
    """
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _auth_error("Missing Bearer token")
    server_key = os.environ.get("OPENEYE_SERVER_API_KEY", "")
    if server_key and token != server_key:
        raise _auth_error("Invalid API key")
    if not token.startswith("oe_"):
        raise _auth_error("API key must start with oe_")
    return token


def _auth_error(detail: str):
    from fastapi import HTTPException
    return HTTPException(status_code=401, detail=detail)
