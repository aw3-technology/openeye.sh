"""Zone enforcement policy — 3D zones (robotics) or screen regions (desktop)."""

from __future__ import annotations

import math

from governance.context import GovernanceContext
from governance.models import GovernanceResult, PolicyDecision, PolicyDomain, Severity
from governance.policies.base import GovernancePolicy


class ZonePolicy(GovernancePolicy):
    name = "zone_policy"
    version = "1.0"
    domain = PolicyDomain.UNIVERSAL
    description = "Enforce spatial zones — 3D for robotics, screen regions for desktop agents."

    def _setup(self, params: dict) -> None:
        self.zones: list[dict] = params.get("zones", [])

    def evaluate(self, context: GovernanceContext) -> list[GovernanceResult]:
        results: list[GovernanceResult] = []

        if context.is_robotics and context.robotics:
            results.extend(self._evaluate_robotics(context))
        if context.is_desktop and context.desktop:
            results.extend(self._evaluate_desktop(context))

        return results

    def _evaluate_robotics(self, context: GovernanceContext) -> list[GovernanceResult]:
        results: list[GovernanceResult] = []
        robotics = context.robotics
        if not robotics:
            return results

        for zone_def in self.zones:
            zone_name = zone_def.get("name", "unnamed")
            level = zone_def.get("level", "danger")
            shape = zone_def.get("shape", "circle")
            on_violation = zone_def.get("on_violation", "warn")

            for obj in robotics.objects:
                if obj.position_3d is None:
                    continue

                in_zone = False
                if shape == "circle":
                    center = zone_def.get("center", [0, 0, 0])
                    radius = zone_def.get("radius_m", 1.0)
                    dist = math.sqrt(
                        (obj.position_3d.x - center[0]) ** 2
                        + (obj.position_3d.y - center[1]) ** 2
                        + (obj.position_3d.z - center[2]) ** 2
                    )
                    in_zone = dist < radius
                elif shape == "box":
                    min_pt = zone_def.get("min", [0, 0, 0])
                    max_pt = zone_def.get("max", [1, 1, 1])
                    in_zone = (
                        min_pt[0] <= obj.position_3d.x <= max_pt[0]
                        and min_pt[1] <= obj.position_3d.y <= max_pt[1]
                        and min_pt[2] <= obj.position_3d.z <= max_pt[2]
                    )

                if in_zone:
                    severity = Severity.CRITICAL if level == "danger" else Severity.HIGH
                    decision = PolicyDecision.DENY if on_violation == "halt" else PolicyDecision.WARN
                    results.append(
                        GovernanceResult(
                            policy_name=self.config.name,
                            decision=decision,
                            reason=f"Object '{obj.label}' (track {obj.track_id}) inside {level} zone '{zone_name}'",
                            severity=severity,
                            affected_objects=[obj.track_id],
                            metadata={"zone": zone_name, "level": level},
                        )
                    )

        return results

    def _evaluate_desktop(self, context: GovernanceContext) -> list[GovernanceResult]:
        results: list[GovernanceResult] = []
        desktop = context.desktop
        if not desktop:
            return results

        for zone_def in self.zones:
            zone_name = zone_def.get("name", "unnamed")
            level = zone_def.get("level", "danger")
            region = zone_def.get("region")
            on_violation = zone_def.get("on_violation", "warn")

            if not region or not desktop.pending_target:
                continue
            target = desktop.pending_target
            if target.region is None:
                continue

            # Check if target region overlaps with zone region
            zr = region
            tr = target.region
            overlap = not (
                tr.x2 < zr.get("x1", 0)
                or tr.x1 > zr.get("x2", 1)
                or tr.y2 < zr.get("y1", 0)
                or tr.y1 > zr.get("y2", 1)
            )

            if overlap:
                severity = Severity.CRITICAL if level == "danger" else Severity.HIGH
                decision = PolicyDecision.DENY if on_violation == "block" else PolicyDecision.WARN
                results.append(
                    GovernanceResult(
                        policy_name=self.config.name,
                        decision=decision,
                        reason=f"Action target in restricted screen zone '{zone_name}'",
                        severity=severity,
                        metadata={"zone": zone_name, "level": level},
                    )
                )

        return results
