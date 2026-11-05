"""Server-side credit balance checks and deductions via the Cred credits API.

Mirrors the website's ``api/cred.ts`` proxy: requests go to
``${CRED_API_BASE}/credits-api/<path>`` with ``x-api-key: CRED_API_KEY`` and
the user's identity (``user_id`` + ``email``) in the body / query string.

* balance  -> ``GET  /credits-api/balance?email=...`` (or ``?user_id=...``)
* deduct   -> ``POST /credits-api/deduct``  ``{amount, reason, ...identity}``
* refund   -> ``POST /credits-api/issue``   ``{amount, reason, ...identity}``

Environment:

* ``CRED_API_KEY``  — Cred server key. **If unset, credits are disabled**: every
  deduction is allowed, refunds are no-ops, the balance reads as 0, and a
  warning is logged once. This keeps self-hosted / dev control planes usable
  without a Cred account.
* ``CRED_API_BASE`` — defaults to Cred's hosted service.
* ``CRED_CREDIT_TYPE_ID`` — optional; restricts balance/deduct/issue to one
  credit type, as the website does.
* ``CRED_APP_ORIGIN`` — sent as ``x-app-origin`` (default https://openeye.sh).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Callable, Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_CRED_API_BASE = "https://eutdgemlrpvnxfkkpvlu.supabase.co/functions/v1"
DEFAULT_APP_ORIGIN = "https://openeye.sh"

# Credit costs per endpoint
CREDIT_COSTS = {
    "detect": 1,
    "depth": 2,
    "describe": 3,
    "stream_frame": 1,
}

# Cred responses that mean "the user can't pay", not "the call broke".
_DENIED_STATUSES = {400, 402, 409, 422}

EmailLookup = Callable[[str], Optional[str]]

_warned_disabled = False


def _warn_disabled_once() -> None:
    global _warned_disabled
    if not _warned_disabled:
        _warned_disabled = True
        logger.warning(
            "CRED_API_KEY is not set: credit checks are DISABLED "
            "(all requests allowed, nothing is charged)."
        )


class CreditsService:
    """Check, deduct and refund credits through the Cred credits API."""

    def __init__(
        self,
        email_lookup: Optional[EmailLookup] = None,
        *,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self._client = client or httpx.AsyncClient(timeout=10.0)
        self._email_lookup = email_lookup
        self._api_key = api_key
        self._api_base = api_base
        self._email_cache: dict[str, Optional[str]] = {}

    # ── Config ──

    @property
    def api_key(self) -> str:
        return (
            self._api_key
            if self._api_key is not None
            else os.environ.get("CRED_API_KEY", "")
        )

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _url(self, path: str) -> str:
        base = (
            self._api_base or os.environ.get("CRED_API_BASE") or DEFAULT_CRED_API_BASE
        )
        return f"{base.rstrip('/')}/credits-api/{path}"

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "x-app-origin": os.environ.get("CRED_APP_ORIGIN", DEFAULT_APP_ORIGIN),
        }

    def _email(self, user_id: str) -> Optional[str]:
        if self._email_lookup is None:
            return None
        if user_id not in self._email_cache:
            try:
                self._email_cache[user_id] = self._email_lookup(user_id)
            except Exception as exc:
                logger.warning("Email lookup failed for user %s: %s", user_id, exc)
                return None
        return self._email_cache[user_id]

    def _identity(self, user_id: str) -> dict[str, Any]:
        body: dict[str, Any] = {"user_id": user_id}
        email = self._email(user_id)
        if email:
            body["email"] = email
            body["user_email"] = email
        return body

    def _mutation_body(self, user_id: str, amount: int, reason: str) -> dict[str, Any]:
        body = {**self._identity(user_id), "amount": amount, "reason": reason}
        credit_type = os.environ.get("CRED_CREDIT_TYPE_ID")
        if credit_type:
            body["credit_type_id"] = credit_type
        return body

    # ── Operations ──

    async def get_balance(self, user_id: str) -> int:
        """Return the user's credit balance (0 when credits are disabled)."""
        if not self.enabled:
            _warn_disabled_once()
            return 0
        email = self._email(user_id)
        params = {"email": email} if email else {"user_id": user_id}
        resp = await self._client.get(
            self._url("balance"), params=params, headers=self._headers()
        )
        resp.raise_for_status()
        data = resp.json() or {}
        balances = data.get("balances")
        if isinstance(balances, list):
            credit_type = os.environ.get("CRED_CREDIT_TYPE_ID")
            if credit_type:
                balances = [
                    b for b in balances if b.get("credit_type_id") == credit_type
                ]
            return int(sum(int(b.get("balance") or 0) for b in balances))
        return int(data.get("balance") or 0)

    async def check_and_deduct(
        self, user_id: str, amount: int, reason: str = "OpenEye API usage"
    ) -> bool:
        """Atomically check and deduct credits. Returns True if successful."""
        if not self.enabled:
            _warn_disabled_once()
            return True
        resp = await self._client.post(
            self._url("deduct"),
            json=self._mutation_body(user_id, amount, reason),
            headers=self._headers(),
        )
        if resp.status_code in _DENIED_STATUSES:
            logger.info(
                "Cred denied deduction of %d for user %s (HTTP %d)",
                amount,
                user_id,
                resp.status_code,
            )
            return False
        resp.raise_for_status()
        data = resp.json() or {}
        return bool(data.get("success", False))

    async def refund(
        self, user_id: str, amount: int, reason: str = "OpenEye API refund"
    ) -> bool:
        """Refund credits back to a user (e.g. after inference failure)."""
        if not self.enabled:
            return True
        try:
            resp = await self._client.post(
                self._url("issue"),
                json=self._mutation_body(user_id, amount, reason),
                headers=self._headers(),
            )
            resp.raise_for_status()
            return bool((resp.json() or {}).get("success", False))
        except Exception:
            logger.exception("Failed to refund %d credits for user %s", amount, user_id)
            return False

    async def close(self) -> None:
        await self._client.aclose()


def db_email_lookup(db: Any) -> EmailLookup:
    """Build an email lookup that reads Better Auth's ``"user"`` table."""

    def _lookup(user_id: str) -> Optional[str]:
        rows = db.query('select "email" from "user" where "id" = %s', [user_id])
        return rows[0]["email"] if rows else None

    return _lookup
