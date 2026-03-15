"""Tests for governance data models."""

import pytest
from governance.models import (
    GovernanceConfig,
    GovernanceResult,
    GovernanceSettings,
    GovernanceVerdict,
    PolicyConfig,
    PolicyDecision,
    PolicyDomain,
    Severity,
    Enforcement,
    AuditEntry,
)


def test_policy_config_defaults():
    pc = PolicyConfig(name="test", type="zone_policy")
    assert pc.enabled is True
    assert pc.domain == PolicyDomain.UNIVERSAL
    assert pc.severity == Severity.MEDIUM
    assert pc.enforcement == Enforcement.ENFORCE


def test_governance_result_creation():
    result = GovernanceResult(
        policy_name="test_policy",
        decision=PolicyDecision.DENY,
        reason="Test reason",
        severity=Severity.HIGH,
        affected_objects=["obj1"],
    )
    assert result.decision == PolicyDecision.DENY
    assert result.affected_objects == ["obj1"]


def test_governance_verdict_defaults():
    verdict = GovernanceVerdict()
    assert verdict.overall_decision == PolicyDecision.ALLOW
    assert verdict.results == []
    assert verdict.violations == []


def test_governance_config_validation():
    config = GovernanceConfig(
        version="1.0",
        name="test-config",
        domain=PolicyDomain.ROBOTICS,
        policies=[
            PolicyConfig(name="zone1", type="zone_policy"),
            PolicyConfig(name="filter1", type="action_filter"),
        ],
    )
    assert len(config.policies) == 2
    assert config.domain == PolicyDomain.ROBOTICS


def test_governance_settings_defaults():
    settings = GovernanceSettings()
    assert settings.log_all_decisions is True
    assert settings.fail_open is False
    assert settings.evaluation_timeout_ms == 50


def test_audit_entry_creation():
    entry = AuditEntry(
        timestamp=1234567890.0,
        policy_name="test",
        decision=PolicyDecision.DENY,
        reason="blocked",
        severity=Severity.HIGH,
    )
    assert entry.frame_id is None
    assert entry.affected_objects == []
