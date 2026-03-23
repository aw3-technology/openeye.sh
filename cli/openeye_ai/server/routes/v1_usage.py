from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from fastapi import Depends, Query, Request
from fastapi.responses import JSONResponse

from openeye_ai.server.state import get_state

from .v1_auth import _valid_api_key

_CREDITS: dict[str, int] = {
    "detect": 1,
    "depth": 2,
    "describe": 5,
}


@dataclass
class _UsageRecord:
    calls: int = 0
    credits: int = 0


@dataclass
class _UsageLedger:
    """Tracks API usage per key.  In production this would be backed by a
    database; here we use a simple in-memory dict so the feature can be
    exercised end-to-end without external deps."""

    starting_credits: int = 1000
    _records: dict[str, dict[str, _UsageRecord]] = field(default_factory=dict)
    _history: list[dict[str, Any]] = field(default_factory=list)

    def record(self, api_key: str, model: str, task: str, credits: int) -> None:
        by_model = self._records.setdefault(api_key, {})
        rec = by_model.setdefault(model, _UsageRecord())
        rec.calls += 1
        rec.credits += credits
        self._history.append(
            {
                "api_key": api_key,
                "model": model,
                "task": task,
                "credits": credits,
                "timestamp": time.time(),
            }
        )

    def summary(self, api_key: str, days: int = 30) -> dict[str, Any]:
        cutoff = time.time() - days * 86400
        by_model = self._records.get(api_key, {})
        total_credits = sum(r.credits for r in by_model.values())
        total_calls = sum(r.calls for r in by_model.values())
        model_breakdown = {
            name: {"calls": r.calls, "credits": r.credits}
            for name, r in by_model.items()
        }
        recent = [h for h in self._history if h["api_key"] == api_key and h["timestamp"] >= cutoff]
        return {
            "credits_remaining": max(self.starting_credits - total_credits, 0),
            "credits_used": total_credits,
            "total_calls": total_calls,
            "by_model": model_breakdown,
            "recent_calls": len(recent),
        }


_default_ledger = _UsageLedger()


def _get_ledger(request: Request) -> _UsageLedger:
    return getattr(request.app.state, "usage_ledger", _default_ledger)


async def models(
    request: Request,
    api_key: str = Depends(_valid_api_key),
):
    """List available models and credit costs."""
    state = get_state(request)
    task = state.model_info.get("task", "detection")
    return JSONResponse({
        "models": [
            {
                "name": state.model_name,
                "task": task,
                "credits_per_call": _CREDITS.get(task, 1),
                "description": state.model_info.get("description", ""),
            }
        ]
    })


async def usage(
    request: Request,
    days: int = Query(30, ge=1, le=365),
    api_key: str = Depends(_valid_api_key),
):
    """Return credit balance and usage statistics."""
    ledger = _get_ledger(request)
    return JSONResponse(ledger.summary(api_key, days=days))
