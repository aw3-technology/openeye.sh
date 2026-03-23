"""Sliding-window rate limiting per API key using api_usage_log counts."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from supabase import Client

logger = logging.getLogger(__name__)

# Default window size in seconds
RATE_LIMIT_WINDOW_SECONDS = 60


class RateLimitService:
    """Rate limiting and usage logging backed by Supabase."""

    def __init__(self, sb: Client) -> None:
        self._sb = sb

    async def check_rate_limit(self, api_key_id: str, limit: int) -> tuple[bool, int, int]:
        """Check if the API key is within its rate limit.

        Returns (allowed, remaining, reset_seconds).
        """
        window_start = (
            datetime.now(timezone.utc) - timedelta(seconds=RATE_LIMIT_WINDOW_SECONDS)
        ).isoformat()

        result = await asyncio.to_thread(
            lambda: self._sb.table("api_usage_log")
            .select("id", count="exact")
            .eq("api_key_id", api_key_id)
            .gte("created_at", window_start)
            .execute()
        )

        count = result.count if result.count is not None else 0
        remaining = max(0, limit - count)
        allowed = count < limit

        return allowed, remaining, RATE_LIMIT_WINDOW_SECONDS

    async def log_usage(
        self,
        api_key_id: str,
        user_id: str,
        endpoint: str,
        model: str | None,
        credits_used: int,
        inference_ms: float | None,
        status_code: int,
    ) -> None:
        """Insert a row into api_usage_log."""
        try:
            await asyncio.to_thread(
                lambda: self._sb.table("api_usage_log").insert(
                    {
                        "api_key_id": api_key_id,
                        "user_id": user_id,
                        "endpoint": endpoint,
                        "model": model,
                        "credits_used": credits_used,
                        "inference_ms": inference_ms,
                        "status_code": status_code,
                    }
                ).execute()
            )
        except Exception as exc:
            logger.error("Failed to log API usage: %s", exc)

    async def get_usage_stats(self, user_id: str, days: int = 30) -> dict:
        """Get aggregated usage stats for a user."""
        since = (
            datetime.now(timezone.utc) - timedelta(days=days)
        ).isoformat()

        # First get total count
        count_result = await asyncio.to_thread(
            lambda: self._sb.table("api_usage_log")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", since)
            .execute()
        )
        total_requests = count_result.count if count_result.count is not None else 0

        result = await asyncio.to_thread(
            lambda: self._sb.table("api_usage_log")
            .select("endpoint, credits_used, created_at")
            .eq("user_id", user_id)
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(1000)
            .execute()
        )

        rows = result.data or []
        truncated = total_requests > 1000
        if truncated:
            logger.warning("Usage stats for user %s truncated: %d total rows, showing 1000", user_id, total_requests)
        total_credits = sum(r.get("credits_used", 0) for r in rows)

        # Group by endpoint
        by_endpoint: dict[str, int] = {}
        for r in rows:
            ep = r.get("endpoint", "unknown")
            by_endpoint[ep] = by_endpoint.get(ep, 0) + 1

        # Group by day
        by_day: dict[str, int] = {}
        for r in rows:
            day = r.get("created_at", "")[:10]
            by_day[day] = by_day.get(day, 0) + r.get("credits_used", 0)

        return {
            "total_requests": total_requests,
            "total_credits_used": total_credits,
            "by_endpoint": by_endpoint,
            "daily_credits": by_day,
            "truncated": truncated,
        }
