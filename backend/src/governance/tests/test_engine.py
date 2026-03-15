"""Tests for the governance engine — evaluation and aggregation."""

import pytest
from governance.engine import GovernanceEngine
from governance.context import GovernanceContext, RoboticsContext, DesktopContext
from governance.models import (
    GovernanceConfig,
    GovernanceSettings,
    PolicyConfig,
    PolicyDecision,
    PolicyDomain,
    Severity,
    Enforcement,
)
from perception.models import (
    ActionSuggestion,
    BBox2D,
    DetectedObject3D,
    Position3D,
)


def _make_robotics_context(
    objects=None, actions=None, velocity=None
) -> GovernanceContext:
    return GovernanceContext(
        frame_id=1,
        timestamp=1000.0,
        robotics=RoboticsContext(
            objects=objects or [],
            action_suggestions=actions or [],
            robot_velocity=velocity,
        ),
    )


def _make_desktop_context(
    screen_text="", pending_action=None, active_app="", active_url=""
) -> GovernanceContext:
    return GovernanceContext(
        frame_id=1,
        timestamp=1000.0,
        desktop=DesktopContext(
            screen_text=screen_text,
            pending_action=pending_action,
            active_app=active_app,
            active_url=active_url,
        ),
    )


def _make_object(label: str, track_id: str = "t1", x=0.0, y=0.0, z=0.0) -> DetectedObject3D:
    return DetectedObject3D(
        track_id=track_id,
        label=label,
        confidence=0.9,
        bbox=BBox2D(x1=0, y1=0, x2=100, y2=100),
        position_3d=Position3D(x=x, y=y, z=z),
    )


class TestEngineBasic:
    def test_empty_engine_allows(self):
        engine = GovernanceEngine()
        ctx = _make_robotics_context()
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.ALLOW

    def test_load_config(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="zone1",
                    type="zone_policy",
                    config={"zones": [{"name": "z", "level": "danger", "shape": "circle", "center": [0, 0, 0], "radius_m": 1.0, "on_violation": "halt"}]},
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        status = engine.get_status()
        assert status.active is True
        assert status.enabled_policies == 1

    def test_enable_disable_policy(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(name="zone1", type="zone_policy", enabled=False, config={"zones": []}),
            ],
        )
        engine = GovernanceEngine(config=config)
        assert engine.get_status().enabled_policies == 0

        engine.enable_policy("zone1")
        assert engine.get_status().enabled_policies == 1

        engine.disable_policy("zone1")
        assert engine.get_status().enabled_policies == 0


class TestZonePolicy:
    def test_object_in_danger_zone_denied(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="workspace",
                    type="zone_policy",
                    severity="critical",
                    config={
                        "zones": [{
                            "name": "danger",
                            "level": "danger",
                            "shape": "circle",
                            "center": [0, 0, 0],
                            "radius_m": 1.0,
                            "on_violation": "halt",
                        }]
                    },
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        obj = _make_object("person", x=0.3, y=0.0, z=0.3)
        ctx = _make_robotics_context(objects=[obj])
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.DENY
        assert len(verdict.violations) > 0

    def test_object_outside_zone_allowed(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="workspace",
                    type="zone_policy",
                    config={
                        "zones": [{
                            "name": "danger",
                            "level": "danger",
                            "shape": "circle",
                            "center": [0, 0, 0],
                            "radius_m": 0.5,
                            "on_violation": "halt",
                        }]
                    },
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        obj = _make_object("cup", x=3.0, y=0.0, z=3.0)
        ctx = _make_robotics_context(objects=[obj])
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.ALLOW


class TestObjectRestriction:
    def test_denied_object(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="obj_filter",
                    type="object_restriction",
                    config={"deny_labels": ["knife", "scissors"], "on_violation": "deny"},
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        ctx = _make_robotics_context(objects=[_make_object("knife")])
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.DENY

    def test_allowed_object(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="obj_filter",
                    type="object_restriction",
                    config={"deny_labels": ["knife"], "on_violation": "deny"},
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        ctx = _make_robotics_context(objects=[_make_object("cup")])
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.ALLOW


class TestActionFilter:
    def test_denied_action(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="action_f",
                    type="action_filter",
                    config={"deny_patterns": ["throw", "launch"]},
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        actions = [ActionSuggestion(action="throw", reason="test", priority=0.5)]
        ctx = _make_robotics_context(actions=actions)
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.DENY

    def test_speed_limit(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="speed",
                    type="action_filter",
                    config={"max_speed": 1.0},
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        ctx = _make_robotics_context(velocity=2.0)
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.DENY


class TestPIIFilter:
    def test_email_detected(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="pii",
                    type="pii_filter",
                    domain="desktop_agent",
                    config={"redact_patterns": [{"type": "email", "action": "redact"}]},
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        ctx = _make_desktop_context(screen_text="Contact john@example.com for info")
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.MODIFY
        assert len(verdict.results) > 0

    def test_ssn_blocked(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="pii",
                    type="pii_filter",
                    domain="desktop_agent",
                    config={"redact_patterns": [{"type": "ssn", "action": "block_and_alert"}]},
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        ctx = _make_desktop_context(screen_text="SSN: 123-45-6789")
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.DENY


class TestEnforcement:
    def test_audit_only_downgrades_deny(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="zone1",
                    type="zone_policy",
                    enforcement="audit_only",
                    config={
                        "zones": [{
                            "name": "z",
                            "level": "danger",
                            "shape": "circle",
                            "center": [0, 0, 0],
                            "radius_m": 10.0,
                            "on_violation": "halt",
                        }]
                    },
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        ctx = _make_robotics_context(objects=[_make_object("person", x=0.1)])
        verdict = engine.evaluate(ctx)
        # Should be audit_only, not deny
        assert verdict.overall_decision == PolicyDecision.AUDIT_ONLY

    def test_warn_only_downgrades_deny(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="obj_f",
                    type="object_restriction",
                    enforcement="warn_only",
                    config={"deny_labels": ["knife"], "on_violation": "deny"},
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        ctx = _make_robotics_context(objects=[_make_object("knife")])
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.WARN


class TestMostRestrictiveWins:
    def test_deny_wins_over_allow(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="allow_all",
                    type="action_filter",
                    config={},
                ),
                PolicyConfig(
                    name="deny_knife",
                    type="object_restriction",
                    config={"deny_labels": ["knife"], "on_violation": "deny"},
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        ctx = _make_robotics_context(objects=[_make_object("knife")])
        verdict = engine.evaluate(ctx)
        assert verdict.overall_decision == PolicyDecision.DENY


class TestAuditIntegration:
    def test_audit_records_evaluations(self):
        config = GovernanceConfig(
            name="test",
            policies=[
                PolicyConfig(
                    name="zone1",
                    type="zone_policy",
                    config={
                        "zones": [{
                            "name": "z",
                            "level": "danger",
                            "shape": "circle",
                            "center": [0, 0, 0],
                            "radius_m": 10.0,
                            "on_violation": "halt",
                        }]
                    },
                ),
            ],
        )
        engine = GovernanceEngine(config=config)
        ctx = _make_robotics_context(objects=[_make_object("person", x=0.1)])
        engine.evaluate(ctx)
        assert engine.audit.total_evaluations == 1
        assert engine.audit.total_violations > 0
        entries = engine.audit.get_entries(limit=10)
        assert len(entries) > 0
