"""Rate limiter policy — max actions per time window, cooldown after errors."""

from __future__ import annotations

import time
from collections import deque

from governance.context import GovernanceContext
from governance.models import GovernanceResult, PolicyDecision, PolicyDomain, Severity
from governance.policies.base import GovernancePolicy


class RateLimiterPolicy(GovernancePolicy):
    name = "rate_limiter"
    version = "1.0"
    domain = PolicyDomain.UNIVERSAL
    description = "Max actions/clicks per time window, cooldown after errors."

    def _setup(self, params: dict) -> None:
        self.max_actions: int = params.get("max_actions", 60)
        self.window_seconds: float = params.get("window_seconds", 60.0)
        self.error_cooldown_seconds: float = params.get("error_cooldown_seconds", 5.0)
        self.max_errors: int = params.get("max_errors", 3)
        self.error_window_seconds: float = params.get("error_window_seconds", 30.0)

        self._action_times: deque[float] = deque()
        self._error_times: deque[float] = deque()
        self._last_error_time: float = 0.0

    def evaluate(self, context: GovernanceContext) -> list[GovernanceResult]:
        results: list[GovernanceResult] = []
        now = time.time()

        # Prune old entries
        while self._action_times and now - self._action_times[0] > self.window_seconds:
            self._action_times.popleft()
        while self._error_times and now - self._error_times[0] > self.error_window_seconds:
            self._error_times.popleft()

        # Check error cooldown
        if self._last_error_time > 0:
            elapsed_since_error = now - self._last_error_time
            if elapsed_since_error < self.error_cooldown_seconds:
                remaining = self.error_cooldown_seconds - elapsed_since_error
                results.append(
                    GovernanceResult(
                        policy_name=self.config.name,
                        decision=PolicyDecision.DENY,
                        reason=f"Error cooldown active ({remaining:.1f}s remaining)",
                        severity=Severity.MEDIUM,
                    )
                )
                return results

        # Check error burst
        if len(self._error_times) >= self.max_errors:
            results.append(
                GovernanceResult(
                    policy_name=self.config.name,
                    decision=PolicyDecision.DENY,
                    reason=f"Too many errors ({len(self._error_times)}) in {self.error_window_seconds}s window",
                    severity=Severity.HIGH,
                )
            )
            return results

        # Check rate limit
        if len(self._action_times) >= self.max_actions:
            results.append(
                GovernanceResult(
                    policy_name=self.config.name,
                    decision=PolicyDecision.DENY,
                    reason=f"Rate limit exceeded: {len(self._action_times)}/{self.max_actions} actions in {self.window_seconds}s",
                    severity=Severity.MEDIUM,
                )
            )
            return results

        # Record this action
        self._action_times.append(now)
        return results

    def record_error(self) -> None:
        """Call this when an action results in an error."""
        now = time.time()
        self._error_times.append(now)
        self._last_error_time = now
