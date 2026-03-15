"""Tests for individual governance policies."""

import pytest
from governance.context import GovernanceContext, RoboticsContext, DesktopContext, UIElement, ScreenRegion
from governance.models import PolicyConfig, PolicyDecision, Severity
from governance.policies.zone_policy import ZonePolicy
from governance.policies.object_restriction import ObjectRestrictionPolicy
from governance.policies.action_filter import ActionFilterPolicy
from governance.policies.pii_filter import PIIFilterPolicy
from governance.policies.interaction_boundary import InteractionBoundaryPolicy
from governance.policies.rate_limiter import RateLimiterPolicy
from perception.models import (
    ActionSuggestion,
    BBox2D,
    DetectedObject3D,
    Position3D,
)


def _obj(label: str, x=0.0, y=0.0, z=0.0, track_id="t1") -> DetectedObject3D:
    return DetectedObject3D(
        track_id=track_id,
        label=label,
        confidence=0.9,
        bbox=BBox2D(x1=0, y1=0, x2=100, y2=100),
        position_3d=Position3D(x=x, y=y, z=z),
    )


def _robotics_ctx(**kwargs) -> GovernanceContext:
    return GovernanceContext(
        frame_id=1, timestamp=1000.0,
        robotics=RoboticsContext(**kwargs),
    )


def _desktop_ctx(**kwargs) -> GovernanceContext:
    return GovernanceContext(
        frame_id=1, timestamp=1000.0,
        desktop=DesktopContext(**kwargs),
    )


class TestZonePolicy:
    def test_circle_zone_detection(self):
        pc = PolicyConfig(name="zone", type="zone_policy", config={
            "zones": [{"name": "danger", "level": "danger", "shape": "circle", "center": [0, 0, 0], "radius_m": 1.0, "on_violation": "halt"}],
        })
        policy = ZonePolicy(pc)
        ctx = _robotics_ctx(objects=[_obj("person", x=0.3)])
        results = policy.evaluate(ctx)
        assert len(results) == 1
        assert results[0].decision == PolicyDecision.DENY

    def test_box_zone_detection(self):
        pc = PolicyConfig(name="zone", type="zone_policy", config={
            "zones": [{"name": "restricted", "level": "danger", "shape": "box", "min": [-1, -1, -1], "max": [1, 1, 1], "on_violation": "halt"}],
        })
        policy = ZonePolicy(pc)
        ctx = _robotics_ctx(objects=[_obj("box", x=0.5, y=0.5, z=0.5)])
        results = policy.evaluate(ctx)
        assert len(results) == 1

    def test_no_violation_outside_zone(self):
        pc = PolicyConfig(name="zone", type="zone_policy", config={
            "zones": [{"name": "danger", "level": "danger", "shape": "circle", "center": [0, 0, 0], "radius_m": 0.5, "on_violation": "halt"}],
        })
        policy = ZonePolicy(pc)
        ctx = _robotics_ctx(objects=[_obj("cup", x=5.0, z=5.0)])
        results = policy.evaluate(ctx)
        assert len(results) == 0


class TestObjectRestriction:
    def test_deny_label(self):
        pc = PolicyConfig(name="obj", type="object_restriction", config={
            "deny_labels": ["knife"], "on_violation": "deny",
        })
        policy = ObjectRestrictionPolicy(pc)
        ctx = _robotics_ctx(objects=[_obj("knife")])
        results = policy.evaluate(ctx)
        assert len(results) == 1
        assert results[0].decision == PolicyDecision.DENY

    def test_deny_pattern(self):
        pc = PolicyConfig(name="obj", type="object_restriction", config={
            "deny_patterns": ["sharp"], "on_violation": "deny",
        })
        policy = ObjectRestrictionPolicy(pc)
        ctx = _robotics_ctx(objects=[_obj("sharp_tool")])
        results = policy.evaluate(ctx)
        assert len(results) == 1


class TestActionFilter:
    def test_deny_action_pattern(self):
        pc = PolicyConfig(name="af", type="action_filter", config={
            "deny_patterns": ["throw"],
        })
        policy = ActionFilterPolicy(pc)
        actions = [ActionSuggestion(action="throw_ball", reason="test", priority=0.5)]
        ctx = _robotics_ctx(action_suggestions=actions)
        results = policy.evaluate(ctx)
        assert len(results) == 1
        assert results[0].decision == PolicyDecision.DENY

    def test_speed_violation(self):
        pc = PolicyConfig(name="af", type="action_filter", config={"max_speed": 1.0})
        policy = ActionFilterPolicy(pc)
        ctx = _robotics_ctx(robot_velocity=2.5)
        results = policy.evaluate(ctx)
        assert len(results) == 1
        assert results[0].severity == Severity.CRITICAL


class TestPIIFilter:
    def test_detect_email(self):
        pc = PolicyConfig(name="pii", type="pii_filter", domain="desktop_agent", config={
            "redact_patterns": [{"type": "email", "action": "redact"}],
        })
        policy = PIIFilterPolicy(pc)
        ctx = _desktop_ctx(screen_text="Email me at test@example.com")
        results = policy.evaluate(ctx)
        assert len(results) == 1
        assert results[0].decision == PolicyDecision.MODIFY

    def test_detect_ssn_blocks(self):
        pc = PolicyConfig(name="pii", type="pii_filter", domain="desktop_agent", config={
            "redact_patterns": [{"type": "ssn", "action": "block_and_alert"}],
        })
        policy = PIIFilterPolicy(pc)
        ctx = _desktop_ctx(screen_text="SSN: 123-45-6789")
        results = policy.evaluate(ctx)
        assert len(results) == 1
        assert results[0].decision == PolicyDecision.DENY

    def test_no_pii(self):
        pc = PolicyConfig(name="pii", type="pii_filter", domain="desktop_agent", config={
            "redact_patterns": [{"type": "email", "action": "redact"}],
        })
        policy = PIIFilterPolicy(pc)
        ctx = _desktop_ctx(screen_text="Hello world, no PII here")
        results = policy.evaluate(ctx)
        assert len(results) == 0


class TestInteractionBoundary:
    def test_denied_app(self):
        pc = PolicyConfig(name="ib", type="interaction_boundary", domain="desktop_agent", config={
            "denied_apps": ["terminal"],
        })
        policy = InteractionBoundaryPolicy(pc)
        ctx = _desktop_ctx(active_app="Terminal")
        results = policy.evaluate(ctx)
        assert len(results) == 1
        assert results[0].decision == PolicyDecision.DENY

    def test_denied_url(self):
        pc = PolicyConfig(name="ib", type="interaction_boundary", domain="desktop_agent", config={
            "denied_urls": ["admin\\."],
        })
        policy = InteractionBoundaryPolicy(pc)
        ctx = _desktop_ctx(active_url="https://admin.example.com")
        results = policy.evaluate(ctx)
        assert len(results) == 1

    def test_read_only_app(self):
        pc = PolicyConfig(name="ib", type="interaction_boundary", domain="desktop_agent", config={
            "read_only_apps": ["banking"],
        })
        policy = InteractionBoundaryPolicy(pc)
        ctx = _desktop_ctx(active_app="Banking App", pending_action="click")
        results = policy.evaluate(ctx)
        assert len(results) == 1


class TestRateLimiter:
    def test_under_limit(self):
        pc = PolicyConfig(name="rl", type="rate_limiter", config={
            "max_actions": 10, "window_seconds": 60,
        })
        policy = RateLimiterPolicy(pc)
        ctx = _robotics_ctx()
        results = policy.evaluate(ctx)
        assert len(results) == 0

    def test_over_limit(self):
        pc = PolicyConfig(name="rl", type="rate_limiter", config={
            "max_actions": 3, "window_seconds": 60,
        })
        policy = RateLimiterPolicy(pc)
        ctx = _robotics_ctx()
        # Burn through the limit
        for _ in range(3):
            policy.evaluate(ctx)
        results = policy.evaluate(ctx)
        assert len(results) == 1
        assert results[0].decision == PolicyDecision.DENY

    def test_error_cooldown(self):
        pc = PolicyConfig(name="rl", type="rate_limiter", config={
            "max_actions": 100, "error_cooldown_seconds": 10,
        })
        policy = RateLimiterPolicy(pc)
        policy.record_error()
        ctx = _robotics_ctx()
        results = policy.evaluate(ctx)
        assert len(results) == 1
        assert results[0].decision == PolicyDecision.DENY
