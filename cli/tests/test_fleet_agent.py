"""Tests for fleet agent and fleet commands CLI commands (Stories 66 + 68)."""

from __future__ import annotations

import sys
from types import ModuleType
from unittest.mock import MagicMock

import pytest
from typer.testing import CliRunner

from openeye_ai.cli import app

runner = CliRunner()


# ── Helpers ─────────────────────────────────────────────────────────


def _inject_fleet_agent_mocks(monkeypatch) -> tuple[MagicMock, MagicMock]:
    """Pre-inject mock fleet.agent.agent and fleet.agent.config into sys.modules
    so the CLI agent command can import them without the real backend package."""
    mock_config_cls = MagicMock(name="AgentConfig")
    mock_agent_cls = MagicMock(name="DeviceAgent")

    config_mod = ModuleType("fleet.agent.config")
    config_mod.AgentConfig = mock_config_cls  # type: ignore[attr-defined]

    agent_mod = ModuleType("fleet.agent.agent")
    agent_mod.DeviceAgent = mock_agent_cls  # type: ignore[attr-defined]

    fleet_mod = ModuleType("fleet")
    fleet_agent_mod = ModuleType("fleet.agent")

    monkeypatch.setitem(sys.modules, "fleet", fleet_mod)
    monkeypatch.setitem(sys.modules, "fleet.agent", fleet_agent_mod)
    monkeypatch.setitem(sys.modules, "fleet.agent.agent", agent_mod)
    monkeypatch.setitem(sys.modules, "fleet.agent.config", config_mod)

    return mock_config_cls, mock_agent_cls


# ── Story 66: fleet agent CLI ──────────────────────────────────────


def test_fleet_agent_missing_api_key():
    result = runner.invoke(app, [
        "fleet", "agent",
        "--device-id", "dev-1",
        "--api-key", "",
    ])
    assert result.exit_code == 1
    assert "API key is required" in result.output


def test_fleet_agent_invalid_server_url():
    result = runner.invoke(app, [
        "fleet", "agent",
        "--device-id", "dev-1",
        "--api-key", "key-123",
        "--server", "ftp://bad-url",
    ])
    assert result.exit_code == 1
    assert "must start with http" in result.output


def test_fleet_agent_invalid_interval():
    result = runner.invoke(app, [
        "fleet", "agent",
        "--device-id", "dev-1",
        "--api-key", "key-123",
        "--interval", "0.5",
    ])
    assert result.exit_code == 1
    assert "at least 1 second" in result.output


def test_fleet_agent_successful_start(monkeypatch):
    mock_config_cls, mock_agent_cls = _inject_fleet_agent_mocks(monkeypatch)
    monkeypatch.setattr("asyncio.run", lambda coro: None)

    result = runner.invoke(app, [
        "fleet", "agent",
        "--device-id", "dev-1",
        "--api-key", "key-123",
        "--server", "http://localhost:8001",
    ])
    assert result.exit_code == 0
    assert "Starting device agent" in result.output
    mock_config_cls.assert_called_once()
    mock_agent_cls.assert_called_once()


def test_fleet_agent_graceful_stop_on_sigint(monkeypatch):
    mock_config_cls, mock_agent_cls = _inject_fleet_agent_mocks(monkeypatch)

    def _raise_keyboard_interrupt(coro):
        raise KeyboardInterrupt

    monkeypatch.setattr("asyncio.run", _raise_keyboard_interrupt)

    result = runner.invoke(app, [
        "fleet", "agent",
        "--device-id", "dev-1",
        "--api-key", "key-123",
    ])
    assert result.exit_code == 0
    assert "Agent stopped" in result.output
    mock_agent_cls.return_value.stop.assert_called_once()


def test_fleet_agent_api_key_from_env(monkeypatch):
    mock_config_cls, mock_agent_cls = _inject_fleet_agent_mocks(monkeypatch)
    monkeypatch.setattr("asyncio.run", lambda coro: None)
    monkeypatch.setenv("OPENEYE_DEVICE_API_KEY", "env-key-456")

    result = runner.invoke(app, [
        "fleet", "agent",
        "--device-id", "dev-1",
    ])
    assert result.exit_code == 0
    assert "Starting device agent" in result.output


# ── Story 68: fleet commands CLI ───────────────────────────────────


def test_fleet_commands_list_with_entries(monkeypatch):
    sample = [
        {
            "id": "cmd-abc-123-def-456",
            "device_id": "dev-111-222-333",
            "command_type": "restart",
            "status": "pending",
            "created_at": "2025-01-01T00:00:00Z",
        },
        {
            "id": "cmd-xyz-789-000-111",
            "device_id": "dev-444-555-666",
            "command_type": "deploy_model",
            "status": "completed",
            "created_at": "2025-01-02T00:00:00Z",
        },
    ]
    monkeypatch.setattr(
        "openeye_ai.commands.fleet.command_queue._get",
        lambda path: sample,
    )
    monkeypatch.setenv("OPENEYE_TOKEN", "test-token")

    result = runner.invoke(app, ["fleet", "commands"])
    assert result.exit_code == 0
    assert "restart" in result.output
    assert "deploy_model" in result.output


def test_fleet_commands_list_empty(monkeypatch):
    monkeypatch.setattr(
        "openeye_ai.commands.fleet.command_queue._get",
        lambda path: [],
    )
    monkeypatch.setenv("OPENEYE_TOKEN", "test-token")

    result = runner.invoke(app, ["fleet", "commands"])
    assert result.exit_code == 0
    assert "No commands found" in result.output


def test_fleet_commands_filter_by_device(monkeypatch):
    captured_path = {}

    def _mock_get(path):
        captured_path["path"] = path
        return []

    monkeypatch.setattr(
        "openeye_ai.commands.fleet.command_queue._get",
        _mock_get,
    )
    monkeypatch.setenv("OPENEYE_TOKEN", "test-token")

    runner.invoke(app, ["fleet", "commands", "--device", "dev-123"])
    assert "device_id=dev-123" in captured_path["path"]


def test_fleet_commands_filter_by_status(monkeypatch):
    captured_path = {}

    def _mock_get(path):
        captured_path["path"] = path
        return []

    monkeypatch.setattr(
        "openeye_ai.commands.fleet.command_queue._get",
        _mock_get,
    )
    monkeypatch.setenv("OPENEYE_TOKEN", "test-token")

    runner.invoke(app, ["fleet", "commands", "--status", "pending"])
    assert "status=pending" in captured_path["path"]


def test_fleet_commands_filter_both(monkeypatch):
    captured_path = {}

    def _mock_get(path):
        captured_path["path"] = path
        return []

    monkeypatch.setattr(
        "openeye_ai.commands.fleet.command_queue._get",
        _mock_get,
    )
    monkeypatch.setenv("OPENEYE_TOKEN", "test-token")

    runner.invoke(app, ["fleet", "commands", "--device", "dev-1", "--status", "failed"])
    assert "device_id=dev-1" in captured_path["path"]
    assert "status=failed" in captured_path["path"]


def test_fleet_commands_dict_response(monkeypatch):
    """Handles {"commands": [...]} response format."""
    sample = {
        "commands": [
            {
                "id": "cmd-111",
                "device_id": "dev-222",
                "command_type": "update_config",
                "status": "pending",
                "created_at": "2025-01-01T00:00:00Z",
            },
        ]
    }
    monkeypatch.setattr(
        "openeye_ai.commands.fleet.command_queue._get",
        lambda path: sample,
    )
    monkeypatch.setenv("OPENEYE_TOKEN", "test-token")

    result = runner.invoke(app, ["fleet", "commands"])
    assert result.exit_code == 0
    assert "update_config" in result.output
