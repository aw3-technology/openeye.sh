"""Server-side credit balance checks and deductions.

Uses httpx to call the cred.diy Supabase Edge Function for atomic
credit operations.
"""

import logging
import os

import httpx

logger = logging.getLogger(__name__)

# Credit costs per endpoint
CREDIT_COSTS = {
    "detect": 1,
    "depth": 2,
    "describe": 3,
    "stream_frame": 1,
}

_EDGE_FUNCTION_URL: str | None = None


def _get_edge_url() -> str:
    global _EDGE_FUNCTION_URL
    if _EDGE_FUNCTION_URL is None:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        _EDGE_FUNCTION_URL = f"{base}/functions/v1/credits"
    return _EDGE_FUNCTION_URL


def _service_key() -> str:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY environment variable is not set. "
            "Credit operations require a valid service role key."
        )
    return key


class CreditsService:
    """Manage credit balances via the cred.diy edge function."""

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=10.0)

    async def get_balance(self, user_id: str) -> int:
        """Return the current credit balance for a user."""
        resp = await self._client.post(
            _get_edge_url(),
            json={"action": "balance", "user_id": user_id},
            headers={"Authorization": f"Bearer {_service_key()}"},
        )
        resp.raise_for_status()
        return resp.json().get("balance", 0)

    async def check_and_deduct(self, user_id: str, amount: int) -> bool:
        """Atomically check and deduct credits. Returns True if successful."""
        resp = await self._client.post(
            _get_edge_url(),
            json={
                "action": "deduct",
                "user_id": user_id,
                "amount": amount,
            },
            headers={"Authorization": f"Bearer {_service_key()}"},
        )
        if resp.status_code == 402:
            return False
        resp.raise_for_status()
        return resp.json().get("success", False)

    async def refund(self, user_id: str, amount: int) -> bool:
        """Refund credits back to a user (e.g. after inference failure)."""
        try:
            resp = await self._client.post(
                _get_edge_url(),
                json={
                    "action": "refund",
                    "user_id": user_id,
                    "amount": amount,
                },
                headers={"Authorization": f"Bearer {_service_key()}"},
            )
            resp.raise_for_status()
            return resp.json().get("success", False)
        except Exception:
            logger.error("Failed to refund %d credits for user %s", amount, user_id)
            return False

    async def close(self) -> None:
        await self._client.aclose()
