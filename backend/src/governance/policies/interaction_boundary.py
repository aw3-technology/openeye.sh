"""Interaction boundary policy — screen region allow/deny, app restrictions, URL blocking."""

from __future__ import annotations

import re

from governance.context import GovernanceContext
from governance.models import GovernanceResult, PolicyDecision, PolicyDomain, Severity
from governance.policies.base import GovernancePolicy


class InteractionBoundaryPolicy(GovernancePolicy):
    name = "interaction_boundary"
    version = "1.0"
    domain = PolicyDomain.DESKTOP_AGENT
    description = "Screen region allow/deny lists, app restrictions, URL pattern blocking."

    def _setup(self, params: dict) -> None:
        self.allowed_regions: list[dict] = params.get("allowed_regions", [])
        self.denied_regions: list[dict] = params.get("denied_regions", [])
        self.allowed_apps: list[str] = params.get("allowed_apps", [])
        self.denied_apps: list[str] = params.get("denied_apps", [])
        self.denied_urls: list[str] = params.get("denied_urls", [])
        self.allowed_urls: list[str] = params.get("allowed_urls", [])
        self.read_only_apps: list[str] = params.get("read_only_apps", [])
        self.deny_action_types: list[str] = params.get("deny_action_types", [])

    def evaluate(self, context: GovernanceContext) -> list[GovernanceResult]:
        results: list[GovernanceResult] = []

        if not context.is_desktop or not context.desktop:
            return results

        desktop = context.desktop

        # App restrictions
        if desktop.active_app:
            app_lower = desktop.active_app.lower()

            if self.denied_apps and any(d.lower() in app_lower for d in self.denied_apps):
                results.append(
                    GovernanceResult(
                        policy_name=self.config.name,
                        decision=PolicyDecision.DENY,
                        reason=f"App '{desktop.active_app}' is restricted",
                        severity=Severity.HIGH,
                    )
                )

            if self.allowed_apps and not any(a.lower() in app_lower for a in self.allowed_apps):
                results.append(
                    GovernanceResult(
                        policy_name=self.config.name,
                        decision=PolicyDecision.DENY,
                        reason=f"App '{desktop.active_app}' is not in the allowed list",
                        severity=Severity.HIGH,
                    )
                )

            # Read-only mode for certain apps
            if any(ro.lower() in app_lower for ro in self.read_only_apps):
                if desktop.pending_action and desktop.pending_action not in ("read", "scroll", "navigate"):
                    results.append(
                        GovernanceResult(
                            policy_name=self.config.name,
                            decision=PolicyDecision.DENY,
                            reason=f"App '{desktop.active_app}' is read-only; action '{desktop.pending_action}' denied",
                            severity=Severity.MEDIUM,
                        )
                    )

        # URL restrictions
        if desktop.active_url:
            url_lower = desktop.active_url.lower()

            for pattern in self.denied_urls:
                if re.search(pattern, url_lower):
                    results.append(
                        GovernanceResult(
                            policy_name=self.config.name,
                            decision=PolicyDecision.DENY,
                            reason=f"URL matches denied pattern '{pattern}'",
                            severity=Severity.HIGH,
                        )
                    )
                    break

            if self.allowed_urls:
                if not any(re.search(p, url_lower) for p in self.allowed_urls):
                    results.append(
                        GovernanceResult(
                            policy_name=self.config.name,
                            decision=PolicyDecision.DENY,
                            reason=f"URL '{desktop.active_url}' is not in the allowed list",
                            severity=Severity.HIGH,
                        )
                    )

        # Action type restrictions
        if desktop.pending_action and self.deny_action_types:
            if any(re.search(p, desktop.pending_action.lower()) for p in self.deny_action_types):
                results.append(
                    GovernanceResult(
                        policy_name=self.config.name,
                        decision=PolicyDecision.DENY,
                        reason=f"Action type '{desktop.pending_action}' is restricted",
                        severity=Severity.HIGH,
                    )
                )

        # Screen region restrictions
        if desktop.pending_target and desktop.pending_target.region:
            tr = desktop.pending_target.region

            # Denied regions
            for dr in self.denied_regions:
                if self._regions_overlap(tr.x1, tr.y1, tr.x2, tr.y2, dr):
                    results.append(
                        GovernanceResult(
                            policy_name=self.config.name,
                            decision=PolicyDecision.DENY,
                            reason=f"Interaction target in denied screen region '{dr.get('name', 'unnamed')}'",
                            severity=Severity.HIGH,
                        )
                    )

            # Allowed regions (if set, must be inside at least one)
            if self.allowed_regions:
                inside_any = any(
                    self._regions_overlap(tr.x1, tr.y1, tr.x2, tr.y2, ar)
                    for ar in self.allowed_regions
                )
                if not inside_any:
                    results.append(
                        GovernanceResult(
                            policy_name=self.config.name,
                            decision=PolicyDecision.DENY,
                            reason="Interaction target outside all allowed screen regions",
                            severity=Severity.HIGH,
                        )
                    )

        return results

    @staticmethod
    def _regions_overlap(
        x1: float, y1: float, x2: float, y2: float, region: dict
    ) -> bool:
        rx1 = region.get("x1", 0)
        ry1 = region.get("y1", 0)
        rx2 = region.get("x2", 1)
        ry2 = region.get("y2", 1)
        return not (x2 < rx1 or x1 > rx2 or y2 < ry1 or y1 > ry2)
