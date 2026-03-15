"""Object restriction policy — allow/deny lists by object label."""

from __future__ import annotations

import re

from governance.context import GovernanceContext
from governance.models import GovernanceResult, PolicyDecision, PolicyDomain, Severity
from governance.policies.base import GovernancePolicy


class ObjectRestrictionPolicy(GovernancePolicy):
    name = "object_restriction"
    version = "1.0"
    domain = PolicyDomain.UNIVERSAL
    description = "Allow/deny interaction with objects by label. Deny interaction with dangerous objects."

    def _setup(self, params: dict) -> None:
        self.deny_labels: list[str] = params.get("deny_labels", [])
        self.allow_labels: list[str] = params.get("allow_labels", [])
        self.deny_patterns: list[str] = params.get("deny_patterns", [])
        self.on_violation: str = params.get("on_violation", "deny")

    def evaluate(self, context: GovernanceContext) -> list[GovernanceResult]:
        results: list[GovernanceResult] = []

        if context.is_robotics and context.robotics:
            for obj in context.robotics.objects:
                result = self._check_label(obj.label, obj.track_id)
                if result:
                    results.append(result)

            # Also check action suggestions targeting denied objects
            for action in context.robotics.action_suggestions:
                if action.target_id:
                    target_obj = next(
                        (o for o in context.robotics.objects if o.track_id == action.target_id),
                        None,
                    )
                    if target_obj:
                        result = self._check_label(target_obj.label, target_obj.track_id)
                        if result:
                            result.affected_objects.append(f"action:{action.action}")
                            results.append(result)

        return results

    def _check_label(self, label: str, track_id: str) -> GovernanceResult | None:
        label_lower = label.lower()

        # Explicit deny list
        if any(d.lower() == label_lower for d in self.deny_labels):
            return GovernanceResult(
                policy_name=self.config.name,
                decision=PolicyDecision.DENY if self.on_violation == "deny" else PolicyDecision.WARN,
                reason=f"Object '{label}' is on the deny list",
                severity=self.config.severity,
                affected_objects=[track_id],
            )

        # Pattern deny
        for pattern in self.deny_patterns:
            if re.search(pattern, label_lower):
                return GovernanceResult(
                    policy_name=self.config.name,
                    decision=PolicyDecision.DENY if self.on_violation == "deny" else PolicyDecision.WARN,
                    reason=f"Object '{label}' matches deny pattern '{pattern}'",
                    severity=self.config.severity,
                    affected_objects=[track_id],
                )

        # Allow list (if set, only allowed labels pass)
        if self.allow_labels and not any(a.lower() == label_lower for a in self.allow_labels):
            return GovernanceResult(
                policy_name=self.config.name,
                decision=PolicyDecision.WARN,
                reason=f"Object '{label}' is not on the allow list",
                severity=Severity.LOW,
                affected_objects=[track_id],
            )

        return None
