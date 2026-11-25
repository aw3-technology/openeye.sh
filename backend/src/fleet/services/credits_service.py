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

Shared AW3 Credit (mirrors ``api/_lib/aw3-credit.ts``; contract: ZeusMCP
``obsidian/backend/aw3-credit.md``). On only when ``AW3_CRED_API_KEY``,
``AW3_CRED_CREDIT_TYPE_ID`` and ``AW3_CRED_PRICING_TIER_ID`` are all set and
the user has a verified email (``aw3_email_lookup``); otherwise billing is
exactly as above. A charge OpenEye's own balance can't cover is charged in
full to the AW3 Credit on the "AW3 Wallet" hub (never split); ``charge``
returns which source paid and ``refund`` sends credits back to that source.
Hub failures are logged and fall back to OpenEye's own credits.
"""

from __future__ import annotations

import logging
import os
import uuid
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
# 404: the user has no Cred account yet, so they have no credits.
_DENIED_STATUSES = {400, 402, 404, 409, 422}

# Shared AW3 Credit (cred.diy "AW3 Wallet" hub)
AW3_SLUG = "openeye"  # prefix of every hub idempotency key
_APP_NAME = "OpenEye"
_HUB_TIMEOUT = 5.0

# Which balance paid for a charge: "app" (OpenEye's own) or "aw3".
CreditSource = str

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
        aw3_email_lookup: Optional[EmailLookup] = None,
    ) -> None:
        self._client = client or httpx.AsyncClient(timeout=10.0)
        self._email_lookup = email_lookup
        # Returns the user's *verified* email (or None): only that keys the AW3 wallet.
        self._aw3_email_lookup = aw3_email_lookup
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

    @staticmethod
    def _aw3_config() -> Optional[dict[str, str]]:
        cfg = {
            "api_key": os.environ.get("AW3_CRED_API_KEY", ""),
            "credit_type_id": os.environ.get("AW3_CRED_CREDIT_TYPE_ID", ""),
            "pricing_tier_id": os.environ.get("AW3_CRED_PRICING_TIER_ID", ""),
        }
        return cfg if all(cfg.values()) else None

    def _aw3_email(self, user_id: str) -> Optional[str]:
        """The user's hub wallet email, or None when the AW3 Credit doesn't apply."""
        if self._aw3_config() is None or self._aw3_email_lookup is None:
            return None
        try:
            email = self._aw3_email_lookup(user_id)
        except Exception as exc:
            logger.warning("AW3 email lookup failed for user %s: %s", user_id, exc)
            return None
        email = (email or "").strip().lower()
        return email or None

    def _hub_headers(self, idempotency_key: Optional[str] = None) -> dict[str, str]:
        cfg = self._aw3_config() or {}
        headers = {**self._headers(), "x-api-key": cfg.get("api_key", "")}
        if idempotency_key:
            headers["Idempotency-Key"] = f"{AW3_SLUG}:{idempotency_key}"
        return headers

    @staticmethod
    def _hub_reason(reason: str) -> str:
        rest = (
            reason[len(_APP_NAME) :].lstrip(":").lstrip()
            if reason.startswith(_APP_NAME)
            else reason
        )
        return f"{_APP_NAME}: {rest}"

    def _hub_body(self, email: str, amount: int, reason: str) -> dict[str, Any]:
        cfg = self._aw3_config() or {}
        return {
            "user_id": email,
            "user_email": email,
            "credit_type_id": cfg.get("credit_type_id"),
            "amount": amount,
            "reason": self._hub_reason(reason),
        }

    async def _hub_post(
        self, path: str, email: str, amount: int, reason: str, key: str
    ) -> bool:
        """POST a hub mutation; False when refused, failed or unreachable (logged)."""
        try:
            resp = await self._client.post(
                self._url(path),
                json=self._hub_body(email, amount, reason),
                headers=self._hub_headers(key),
                timeout=_HUB_TIMEOUT,
            )
        except Exception as exc:
            logger.error("AW3 hub %s unreachable: %s", path, exc)
            return False
        if resp.status_code >= 400:
            if resp.status_code not in _DENIED_STATUSES:
                logger.error("AW3 hub %s failed (HTTP %d)", path, resp.status_code)
            return False
        return True

    async def _aw3_balance(self, email: str) -> int:
        """AW3 Credit balance on the hub; 0 (logged) when the hub can't be read."""
        cfg = self._aw3_config() or {}
        try:
            resp = await self._client.get(
                self._url("balance"),
                params={"email": email, "credit_type_id": cfg.get("credit_type_id")},
                headers=self._hub_headers(),
                timeout=_HUB_TIMEOUT,
            )
            if resp.status_code == 404:
                return 0
            resp.raise_for_status()
            balances = (resp.json() or {}).get("balances") or []
            return int(
                sum(
                    int(b.get("balance") or 0)
                    for b in balances
                    if b.get("credit_type_id") == cfg.get("credit_type_id")
                )
            )
        except Exception as exc:
            logger.error("AW3 hub balance failed: %s", exc)
            return 0

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
        """OpenEye's own balance plus the AW3 Credit (0 when credits are disabled)."""
        if not self.enabled:
            _warn_disabled_once()
            return 0
        legacy = await self._legacy_balance(user_id)
        aw3_email = self._aw3_email(user_id)
        return legacy + (await self._aw3_balance(aw3_email) if aw3_email else 0)

    async def _legacy_balance(self, user_id: str) -> int:
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
        return await self.charge(user_id, amount, reason) is not None

    async def charge(
        self, user_id: str, amount: int, reason: str = "OpenEye API usage"
    ) -> Optional[CreditSource]:
        """Charge OpenEye's own credits, else all of it to the AW3 Credit.

        Returns the source that paid ("app" | "aw3"), or None when neither
        covers it. Pass the source to ``refund``.
        """
        if not self.enabled:
            _warn_disabled_once()
            return "app"
        if await self._legacy_deduct(user_id, amount, reason):
            return "app"
        aw3_email = self._aw3_email(user_id)
        if aw3_email and await self._hub_post(
            "deduct", aw3_email, amount, reason, f"deduct:{uuid.uuid4()}"
        ):
            return "aw3"
        return None

    async def _legacy_deduct(self, user_id: str, amount: int, reason: str) -> bool:
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
        self,
        user_id: str,
        amount: int,
        reason: str = "OpenEye API refund",
        source: CreditSource = "app",
    ) -> bool:
        """Refund credits back to the source that paid (e.g. after inference failure)."""
        if not self.enabled:
            return True
        if source == "aw3":
            aw3_email = self._aw3_email(user_id)
            ok = bool(aw3_email) and await self._hub_post(
                "issue", aw3_email or "", amount, reason, f"refund:{uuid.uuid4()}"
            )
            if not ok:
                logger.error(
                    "Failed to refund %d AW3 credits for user %s", amount, user_id
                )
            return ok
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


def db_verified_email_lookup(db: Any) -> EmailLookup:
    """Like ``db_email_lookup``, but only a verified email (it keys the AW3 wallet)."""

    def _lookup(user_id: str) -> Optional[str]:
        rows = db.query(
            'select "email" from "user" where "id" = %s and "emailVerified" = true',
            [user_id],
        )
        return rows[0]["email"] if rows else None

    return _lookup
