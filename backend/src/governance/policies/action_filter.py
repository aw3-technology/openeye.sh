"""Action filter policy — allow/deny actions by pattern regex, speed limits."""

from __future__ import annotations

import re

from governance.context import GovernanceContext
from governance.models import GovernanceResult, PolicyDecision, PolicyDomain, Severity
from governance.policies.base import GovernancePolicy


class ActionFilterPolicy(GovernancePolicy):
    name = "action_filter"
    version = "1.0"
    domain = PolicyDomain.UNIVERSAL
    description = "Allow/deny actions by pattern regex. Speed limits, action type restrictions."

    def _setup(self, params: dict) -> None:
        self.deny_patterns: list[str] = params.get("deny_patterns", [])
        self.allow_patterns: list[str] = params.get("allow_patterns", [])
        self.max_speed: float | None = params.get("max_speed")

    def evaluate(self, context: GovernanceContext) -> list[GovernanceResult]:
        results: list[GovernanceResult] = []

        # Check robotics actions
        if context.is_robotics and context.robotics:
            for action in context.robotics.action_suggestions:
                r = self._check_action(action.action, action.target_id)
                if r:
                    results.append(r)

            # Speed limit check
            if self.max_speed is not None and context.robotics.robot_velocity is not None:
                if context.robotics.robot_velocity > self.max_speed:
                    results.append(
                        GovernanceResult(
                            policy_name=self.config.name,
                            decision=PolicyDecision.DENY,
                            reason=f"Robot velocity {context.robotics.robot_velocity:.2f} m/s exceeds limit {self.max_speed} m/s",
                            severity=Severity.CRITICAL,
                            modifications={"max_speed": self.max_speed},
                        )
                    )

        # Check desktop actions
        if context.is_desktop and context.desktop:
            if context.desktop.pending_action:
                r = self._check_action(context.desktop.pending_action)
                if r:
                    results.append(r)

        return results

    def _check_action(self, action: str, target_id: str | None = None) -> GovernanceResult | None:
        action_lower = action.lower()

        for pattern in self.deny_patterns:
            if re.search(pattern, action_lower):
                return GovernanceResult(
                    policy_name=self.config.name,
                    decision=PolicyDecision.DENY,
                    reason=f"Action '{action}' matches deny pattern '{pattern}'",
                    severity=self.config.severity,
                    affected_objects=[target_id] if target_id else [],
                )

        if self.allow_patterns:
            if not any(re.search(p, action_lower) for p in self.allow_patterns):
                return GovernanceResult(
                    policy_name=self.config.name,
                    decision=PolicyDecision.DENY,
                    reason=f"Action '{action}' not in allow list",
                    severity=self.config.severity,
                    affected_objects=[target_id] if target_id else [],
                )

        return None
