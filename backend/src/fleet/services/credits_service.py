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

Electrum, the credit shared by every AW3 app (mirrors ``api/_lib/electrum.ts``;
contract: ZeusMCP ``obsidian/backend/aw3-credit.md``). On only when
``ELECTRUM_ENABLED=true`` and the user has a verified email
(``aw3_email_lookup``); otherwise billing is exactly as above. cred.diy does it
natively on OpenEye's own key: the one ``/deduct`` carries
``shared_fallback: true`` and cred.diy charges OpenEye's credits when they cover
it, else all of it in Electrum (converted at the type's ``shared_rate``, never
split). ``charge`` returns a ``Charge`` with cred.diy's ``paid_from``; a refund of
an Electrum-paid charge is ``POST /refund {transaction_id, shared: true}``.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
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

# Electrum fallback refusals cred.diy returns before writing anything: the same
# call without ``shared_fallback`` is then safe (hub not linked / no rate yet).
_FALLBACK_UNAVAILABLE = {"SHARED_NOT_LINKED", "SHARED_RATE_MISSING"}


@dataclass(frozen=True)
class Charge:
    """A charge that went through: who paid ("app" | "shared") and its transaction id."""

    source: str = "app"
    transaction_id: Optional[str] = None


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
        # Returns the user's *verified* email (or None): only that names the Electrum wallet.
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

    def _aw3_email(self, user_id: str) -> Optional[str]:
        """The user's Electrum wallet email, or None when Electrum doesn't apply."""
        if (
            os.environ.get("ELECTRUM_ENABLED") != "true"
            or self._aw3_email_lookup is None
        ):
            return None
        try:
            email = self._aw3_email_lookup(user_id)
        except Exception as exc:
            logger.warning("Verified email lookup failed for user %s: %s", user_id, exc)
            return None
        email = (email or "").strip().lower()
        return email or None

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
        """OpenEye's own credit balance (0 when credits are disabled)."""
        return (await self.get_balances(user_id))[0]

    async def get_balances(self, user_id: str) -> tuple[int, Optional[float]]:
        """OpenEye's own balance and the person's Electrum (None when off/unverified)."""
        if not self.enabled:
            _warn_disabled_once()
            return 0, None
        email = self._email(user_id)
        params: dict[str, str] = {"email": email} if email else {"user_id": user_id}
        shared_email = self._aw3_email(user_id)
        if shared_email:
            params = {"email": shared_email, "include_shared": "true"}
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
            app = int(sum(int(b.get("balance") or 0) for b in balances))
        else:
            app = int(data.get("balance") or 0)
        shared = data.get("shared_balance") if shared_email else None
        electrum = (
            float(shared.get("balance") or 0) if isinstance(shared, dict) else None
        )
        return app, electrum

    async def check_and_deduct(
        self, user_id: str, amount: int, reason: str = "OpenEye API usage"
    ) -> bool:
        """Atomically check and deduct credits. Returns True if successful."""
        return await self.charge(user_id, amount, reason) is not None

    async def charge(
        self, user_id: str, amount: int, reason: str = "OpenEye API usage"
    ) -> Optional[Charge]:
        """Charge ``amount`` in one ``/deduct`` (Electrum fallback when on).

        Returns the ``Charge`` (pass it to ``refund``), or None when refused.
        """
        if not self.enabled:
            _warn_disabled_once()
            return Charge()
        body = self._mutation_body(user_id, amount, reason)
        shared_email = self._aw3_email(user_id)
        if shared_email:
            body.update(
                shared_fallback=True, user_email=shared_email, email=shared_email
            )
        resp = await self._post_deduct(body)
        if shared_email and resp.status_code == 400:
            code = self._error_code(resp)
            if code in _FALLBACK_UNAVAILABLE:
                logger.warning(
                    "Electrum fallback unavailable (%s); charging OpenEye credits only",
                    code,
                )
                body.pop("shared_fallback", None)
                resp = await self._post_deduct(body)
        if resp.status_code in _DENIED_STATUSES:
            logger.info(
                "Cred denied deduction of %d for user %s (HTTP %d)",
                amount,
                user_id,
                resp.status_code,
            )
            return None
        resp.raise_for_status()
        data = resp.json() or {}
        if not data.get("success", False):
            return None
        source = "shared" if data.get("paid_from") == "shared" else "app"
        return Charge(source=source, transaction_id=data.get("transaction_id"))

    async def _post_deduct(self, body: dict[str, Any]) -> httpx.Response:
        return await self._client.post(
            self._url("deduct"), json=body, headers=self._headers()
        )

    @staticmethod
    def _error_code(resp: httpx.Response) -> Optional[str]:
        try:
            return (resp.json() or {}).get("code")
        except Exception:
            return None

    async def refund(
        self,
        user_id: str,
        amount: int,
        reason: str = "OpenEye API refund",
        charge: Optional[Charge] = None,
    ) -> bool:
        """Refund a charge to the balance that paid (e.g. after inference failure)."""
        if not self.enabled:
            return True
        if charge is not None and charge.source == "shared":
            # The whole Electrum charge goes back, in Electrum, by transaction id.
            try:
                resp = await self._client.post(
                    self._url("refund"),
                    json={
                        "transaction_id": charge.transaction_id,
                        "shared": True,
                        "reason": reason,
                    },
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return True
            except Exception:
                logger.exception(
                    "Failed to refund Electrum charge %s for user %s",
                    charge.transaction_id,
                    user_id,
                )
                return False
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
    """Like ``db_email_lookup``, but only a verified email (it names the Electrum wallet)."""

    def _lookup(user_id: str) -> Optional[str]:
        rows = db.query(
            'select "email" from "user" where "id" = %s and "emailVerified" = true',
            [user_id],
        )
        return rows[0]["email"] if rows else None

    return _lookup
