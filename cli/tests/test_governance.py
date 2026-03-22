"""Tests for governance CLI commands."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

from openeye_ai.commands.governance import govern_app

runner = CliRunner()


# ── govern status ────────────────────────────────────────────────────


def test_status_with_server():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "active": True,
        "config_name": "my-config",
        "domain": "robotics",
        "enabled_policies": 3,
        "total_policies": 5,
        "total_evaluations": 100,
        "total_violations": 2,
        "total_warnings": 5,
        "fail_open": False,
        "enabled_policy_names": ["zone_policy", "action_filter"],
    }

    with patch("httpx.get", return_value=mock_resp):
        result = runner.invoke(govern_app, ["status", "--server", "http://localhost:8000"])
    assert result.exit_code == 0
    assert "Governance Status" in result.output


def test_status_with_server_error():
    import httpx

    with patch("httpx.get", side_effect=httpx.ConnectError("refused")):
        result = runner.invoke(govern_app, ["status", "--server", "http://localhost:8000"])
    assert result.exit_code == 1
    assert "Error" in result.output


def test_status_local():
    mock_engine = MagicMock()
    mock_status = MagicMock()
    mock_status.model_dump.return_value = {
        "active": False,
        "config_name": "none",
        "domain": "universal",
        "enabled_policies": 0,
        "total_policies": 0,
        "total_evaluations": 0,
        "total_violations": 0,
        "total_warnings": 0,
        "fail_open": False,
    }
    mock_engine.get_status.return_value = mock_status

    with patch("openeye_ai.commands.governance._get_engine", return_value=mock_engine):
        result = runner.invoke(govern_app, ["status"])
    assert result.exit_code == 0
    assert "local engine" in result.output.lower()


# ── govern ls ────────────────────────────────────────────────────────


def test_ls():
    mock_engine = MagicMock()
    mock_policy = MagicMock()
    mock_policy.name = "zone_policy"
    mock_policy.domain.value = "robotics"
    mock_policy.description = "Zone-based constraints"
    mock_policy.is_plugin = False
    mock_engine.list_available_types.return_value = [mock_policy]

    with patch("openeye_ai.commands.governance._get_engine", return_value=mock_engine):
        result = runner.invoke(govern_app, ["ls"])
    assert result.exit_code == 0
    assert "zone_policy" in result.output
    assert "robotics" in result.output


# ── govern enable ────────────────────────────────────────────────────


def test_enable_with_server():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_resp):
        result = runner.invoke(govern_app, ["enable", "zone_policy", "--server", "http://localhost:8000"])
    assert result.exit_code == 0
    assert "Enabled" in result.output


def test_enable_local_success():
    mock_engine = MagicMock()
    mock_engine.enable_policy.return_value = True

    with patch("openeye_ai.commands.governance._get_engine", return_value=mock_engine):
        result = runner.invoke(govern_app, ["enable", "zone_policy"])
    assert result.exit_code == 0
    assert "Enabled" in result.output


def test_enable_local_not_found():
    mock_engine = MagicMock()
    mock_engine.enable_policy.return_value = False

    with patch("openeye_ai.commands.governance._get_engine", return_value=mock_engine):
        result = runner.invoke(govern_app, ["enable", "no_such_policy"])
    assert result.exit_code == 1
    assert "not found" in result.output.lower()


# ── govern disable ───────────────────────────────────────────────────


def test_disable_with_server():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_resp):
        result = runner.invoke(govern_app, ["disable", "zone_policy", "--server", "http://localhost:8000"])
    assert result.exit_code == 0
    assert "Disabled" in result.output


def test_disable_local_success():
    mock_engine = MagicMock()
    mock_engine.disable_policy.return_value = True

    with patch("openeye_ai.commands.governance._get_engine", return_value=mock_engine):
        result = runner.invoke(govern_app, ["disable", "zone_policy"])
    assert result.exit_code == 0
    assert "Disabled" in result.output


def test_disable_local_not_found():
    mock_engine = MagicMock()
    mock_engine.disable_policy.return_value = False

    with patch("openeye_ai.commands.governance._get_engine", return_value=mock_engine):
        result = runner.invoke(govern_app, ["disable", "no_such_policy"])
    assert result.exit_code == 1
    assert "not found" in result.output.lower()


# ── govern presets ───────────────────────────────────────────────────


def test_presets_with_names():
    with patch("governance.loader.list_presets", return_value=["robotics-safe", "desktop-default"]):
        result = runner.invoke(govern_app, ["presets"])
    assert result.exit_code == 0
    assert "robotics-safe" in result.output
    assert "desktop-default" in result.output


def test_presets_empty():
    with patch("governance.loader.list_presets", return_value=[]):
        result = runner.invoke(govern_app, ["presets"])
    assert result.exit_code == 0
    assert "No presets" in result.output


# ── govern validate ──────────────────────────────────────────────────


def test_validate_valid():
    with patch("governance.loader.validate_yaml", return_value=(True, "Config is valid")):
        result = runner.invoke(govern_app, ["validate", "config.yaml"])
    assert result.exit_code == 0
    assert "Valid" in result.output


def test_validate_invalid():
    with patch("governance.loader.validate_yaml", return_value=(False, "Missing required field")):
        result = runner.invoke(govern_app, ["validate", "config.yaml"])
    assert result.exit_code == 1
    assert "Invalid" in result.output


# ── govern init ──────────────────────────────────────────────────────


def test_init_default(tmp_path):
    output = tmp_path / "governance.yaml"
    result = runner.invoke(govern_app, ["init", "--output", str(output)])
    assert result.exit_code == 0
    assert output.exists()
    content = output.read_text()
    assert "policies" in content
    assert "version" in content


def test_init_robotics_domain(tmp_path):
    output = tmp_path / "gov.yaml"
    result = runner.invoke(govern_app, ["init", "--domain", "robotics", "--output", str(output)])
    assert result.exit_code == 0
    content = output.read_text()
    assert "robotics" in content


def test_init_desktop_agent_domain(tmp_path):
    output = tmp_path / "gov.yaml"
    result = runner.invoke(govern_app, ["init", "--domain", "desktop_agent", "--output", str(output)])
    assert result.exit_code == 0
    content = output.read_text()
    assert "desktop_agent" in content


# ── govern audit ─────────────────────────────────────────────────────


def test_audit_with_server():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = [
        {"timestamp": "2026-01-01T00:00:00Z", "policy_name": "zone_policy", "decision": "allow", "severity": "low", "reason": "ok"},
    ]

    with patch("httpx.get", return_value=mock_resp):
        result = runner.invoke(govern_app, ["audit", "--server", "http://localhost:8000"])
    assert result.exit_code == 0
    assert "zone_policy" in result.output


def test_audit_empty():
    mock_engine = MagicMock()
    mock_engine.audit.get_entries.return_value = []

    with patch("openeye_ai.commands.governance._get_engine", return_value=mock_engine):
        result = runner.invoke(govern_app, ["audit"])
    assert result.exit_code == 0
    assert "No" in result.output


# ── govern violations ────────────────────────────────────────────────


def test_violations_with_server():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = [
        {"timestamp": "2026-01-01T00:00:00Z", "policy_name": "zone_policy", "decision": "deny", "severity": "critical", "reason": "out of bounds"},
    ]

    with patch("httpx.get", return_value=mock_resp):
        result = runner.invoke(govern_app, ["violations", "--server", "http://localhost:8000"])
    assert result.exit_code == 0
    assert "zone_policy" in result.output


def test_violations_server_error():
    import httpx

    with patch("httpx.get", side_effect=httpx.ConnectError("refused")):
        result = runner.invoke(govern_app, ["violations", "--server", "http://localhost:8000"])
    assert result.exit_code == 1
    assert "Error" in result.output


# ── govern load ──────────────────────────────────────────────────────


def test_load_preset_via_server():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.post", return_value=mock_resp):
        result = runner.invoke(govern_app, ["load", "robotics-safe", "--server", "http://localhost:8000"])
    assert result.exit_code == 0
    assert "Loaded preset" in result.output


def test_load_local_preset():
    mock_config = MagicMock()
    mock_config.name = "robotics-safe"
    mock_config.policies = [1, 2, 3]

    with patch("governance.loader.load_preset", return_value=mock_config):
        result = runner.invoke(govern_app, ["load", "robotics-safe"])
    assert result.exit_code == 0
    assert "Valid preset" in result.output
    assert "3 policies" in result.output


def test_load_local_preset_error():
    with patch("governance.loader.load_preset", side_effect=FileNotFoundError("not found")):
        result = runner.invoke(govern_app, ["load", "no-such-preset"])
    assert result.exit_code == 1
    assert "Error" in result.output
