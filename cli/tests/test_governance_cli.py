"""Tests for governance CLI commands (Stories 90–95)."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import yaml
from typer.testing import CliRunner

# Ensure backend/src is importable for governance modules
_BACKEND_SRC = str(Path(__file__).resolve().parents[2] / "backend" / "src")
if _BACKEND_SRC not in sys.path:
    sys.path.insert(0, _BACKEND_SRC)

from governance.audit import AuditLog
from governance.models import (
    AuditEntry,
    GovernanceConfig,
    GovernanceStatus,
    PolicyConfig,
    PolicyDecision,
    PolicyDomain,
    PolicyInfo,
    Severity,
)
from openeye_ai.cli import app

runner = CliRunner()


# ── Helpers ──────────────────────────────────────────────────────────


def _make_engine(
    preset: str | None = None,
    policies: list[PolicyConfig] | None = None,
    audit_entries: list[AuditEntry] | None = None,
):
    """Build a real GovernanceEngine with optional preset/config."""
    from governance.engine import GovernanceEngine

    engine = GovernanceEngine()
    if preset:
        engine.load_preset(preset)
    if policies:
        config = GovernanceConfig(policies=policies)
        engine.load_config(config)
    if audit_entries:
        for entry in audit_entries:
            engine.audit._entries.append(entry)
    return engine


def _patch_engine(engine):
    """Return a patch context that makes _get_engine() return *engine*."""
    return patch("openeye_ai.commands.governance._get_engine", return_value=engine)


# ── Story 90: status shows enabled_policy_names ─────────────────────


class TestStatusPolicyNames:
    def test_status_local_shows_policy_names(self):
        engine = _make_engine(preset="robotics_safety")
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "status"])
        assert result.exit_code == 0
        assert "Active policies:" in result.output
        assert "action_rate" in result.output
        assert "action_safety" in result.output
        assert "dangerous_objects" in result.output
        assert "workspace_boundaries" in result.output

    def test_status_local_no_policies_no_bullet(self):
        engine = _make_engine()
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "status"])
        assert result.exit_code == 0
        assert "Active policies:" not in result.output

    def test_status_model_has_enabled_policy_names_field(self):
        engine = _make_engine(preset="robotics_safety")
        status = engine.get_status()
        assert isinstance(status.enabled_policy_names, list)
        assert "action_safety" in status.enabled_policy_names
        assert len(status.enabled_policy_names) == 4


# ── Story 91: local enable / disable ────────────────────────────────


class TestLocalEnableDisable:
    def test_enable_known_policy(self):
        engine = _make_engine(preset="robotics_safety")
        engine.disable_policy("action_safety")
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "enable", "action_safety"])
        assert result.exit_code == 0
        assert "Enabled policy" in result.output

    def test_enable_unknown_policy_fails(self):
        engine = _make_engine(preset="robotics_safety")
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "enable", "nonexistent"])
        assert result.exit_code == 1
        assert "Policy not found" in result.output

    def test_disable_known_policy(self):
        engine = _make_engine(preset="robotics_safety")
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "disable", "action_safety"])
        assert result.exit_code == 0
        assert "Disabled policy" in result.output

    def test_disable_unknown_policy_fails(self):
        engine = _make_engine(preset="robotics_safety")
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "disable", "nonexistent"])
        assert result.exit_code == 1
        assert "Policy not found" in result.output


# ── Story 92: robotics preset exists ────────────────────────────────


class TestRoboticsPreset:
    def test_robotics_preset_loads(self):
        from governance.loader import load_preset

        config = load_preset("robotics")
        assert config.name == "robotics"
        assert config.domain == PolicyDomain.ROBOTICS

    def test_robotics_preset_extends_safety(self):
        from governance.loader import load_preset, resolve_config

        config = load_preset("robotics")
        resolved = resolve_config(config)
        names = {p.name for p in resolved.policies}
        # Inherited from robotics_safety
        assert "workspace_boundaries" in names
        assert "dangerous_objects" in names
        assert "action_safety" in names
        assert "action_rate" in names
        # New policy
        assert "human-detection-blur" in names

    def test_robotics_preset_in_list(self):
        from governance.loader import list_presets

        presets = list_presets()
        assert "robotics" in presets

    def test_robotics_human_detection_blur_policy(self):
        from governance.loader import load_preset

        config = load_preset("robotics")
        blur = next((p for p in config.policies if p.name == "human-detection-blur"), None)
        assert blur is not None
        assert blur.type == "pii_filter"


# ── Story 93: local audit ───────────────────────────────────────────


class TestLocalAudit:
    def test_audit_local_empty(self):
        engine = _make_engine()
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "audit"])
        assert result.exit_code == 0
        assert "audit trail" in result.output.lower() or "no" in result.output.lower()

    def test_audit_local_with_entries(self):
        engine = _make_engine()
        entries = [
            AuditEntry(
                timestamp=1000.0,
                policy_name="action_safety",
                decision=PolicyDecision.DENY,
                reason="threw object",
                severity=Severity.HIGH,
            ),
            AuditEntry(
                timestamp=1001.0,
                policy_name="workspace_boundaries",
                decision=PolicyDecision.ALLOW,
                reason="within bounds",
                severity=Severity.INFO,
            ),
        ]
        for e in entries:
            engine.audit._entries.append(e)
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "audit"])
        assert result.exit_code == 0
        assert "action_safety" in result.output
        assert "threw object" in result.output

    def test_audit_local_respects_limit(self):
        engine = _make_engine()
        for i in range(10):
            engine.audit._entries.append(
                AuditEntry(
                    timestamp=float(i),
                    policy_name=f"policy_{i}",
                    decision=PolicyDecision.ALLOW,
                    reason=f"reason_{i}",
                    severity=Severity.INFO,
                )
            )
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "audit", "--limit", "3"])
        assert result.exit_code == 0
        # Should show the 3 most recent (newest first: 9, 8, 7)
        assert "policy_9" in result.output
        assert "policy_0" not in result.output


# ── Story 94: local violations ──────────────────────────────────────


class TestLocalViolations:
    def test_violations_local_empty(self):
        engine = _make_engine()
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "violations"])
        assert result.exit_code == 0
        assert "violations" in result.output.lower() or "no" in result.output.lower()

    def test_violations_local_filters_denies(self):
        engine = _make_engine()
        engine.audit._entries.append(
            AuditEntry(
                timestamp=1000.0,
                policy_name="action_safety",
                decision=PolicyDecision.DENY,
                reason="threw object",
                severity=Severity.HIGH,
            )
        )
        engine.audit._entries.append(
            AuditEntry(
                timestamp=1001.0,
                policy_name="workspace_boundaries",
                decision=PolicyDecision.ALLOW,
                reason="within bounds",
                severity=Severity.INFO,
            )
        )
        with _patch_engine(engine):
            result = runner.invoke(app, ["govern", "violations"])
        assert result.exit_code == 0
        assert "action_safety" in result.output
        assert "threw object" in result.output
        # ALLOW entry should NOT appear in violations
        assert "within bounds" not in result.output


# ── Story 95: domain-specific init ──────────────────────────────────


class TestDomainInit:
    def test_init_robotics_has_zone_and_object_and_action(self, tmp_path):
        out = tmp_path / "gov.yaml"
        result = runner.invoke(app, ["govern", "init", "--domain", "robotics", "--output", str(out)])
        assert result.exit_code == 0
        data = yaml.safe_load(out.read_text())
        policy_types = {p["type"] for p in data["policies"]}
        assert "zone_policy" in policy_types
        assert "object_restriction" in policy_types
        assert "action_filter" in policy_types

    def test_init_desktop_agent_has_pii_and_boundary(self, tmp_path):
        out = tmp_path / "gov.yaml"
        result = runner.invoke(app, ["govern", "init", "--domain", "desktop_agent", "--output", str(out)])
        assert result.exit_code == 0
        data = yaml.safe_load(out.read_text())
        policy_types = {p["type"] for p in data["policies"]}
        assert "pii_filter" in policy_types
        assert "interaction_boundary" in policy_types
        assert "zone_policy" not in policy_types

    def test_init_universal_has_action_filter_only(self, tmp_path):
        out = tmp_path / "gov.yaml"
        result = runner.invoke(app, ["govern", "init", "--domain", "universal", "--output", str(out)])
        assert result.exit_code == 0
        data = yaml.safe_load(out.read_text())
        policy_types = {p["type"] for p in data["policies"]}
        assert policy_types == {"action_filter"}

    def test_init_default_domain_is_robotics(self, tmp_path):
        out = tmp_path / "gov.yaml"
        result = runner.invoke(app, ["govern", "init", "--output", str(out)])
        assert result.exit_code == 0
        data = yaml.safe_load(out.read_text())
        assert data["domain"] == "robotics"
        assert len(data["policies"]) == 3

    def test_init_unknown_domain_falls_back_to_universal(self, tmp_path):
        out = tmp_path / "gov.yaml"
        result = runner.invoke(app, ["govern", "init", "--domain", "unknown_stuff", "--output", str(out)])
        assert result.exit_code == 0
        data = yaml.safe_load(out.read_text())
        # Falls back to universal (action_filter only)
        assert len(data["policies"]) == 1
        assert data["policies"][0]["type"] == "action_filter"
