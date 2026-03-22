"""Tests for fleet device commands (stories 51-55, 61-62)."""

from __future__ import annotations

import json

import pytest

from openeye_ai.cli import app
from .conftest import make_device


# ── Story 51: register ───────────────────────────────────────────


class TestRegister:
    def test_register_returns_id_and_api_key(self, fleet_runner, mock_request):
        mock = mock_request({"id": "dev-uuid-1", "api_key": "oek_secret123"})
        result = fleet_runner.invoke(app, ["fleet", "register", "cam-front"])
        assert result.exit_code == 0
        assert "dev-uuid-1" in result.output
        assert "oek_secret123" in result.output

    def test_register_with_type_flag(self, fleet_runner, mock_request):
        mock = mock_request({"id": "dev-uuid-2", "api_key": "oek_abc"})
        fleet_runner.invoke(app, ["fleet", "register", "cam-dock", "--type", "camera"])
        mock.assert_called_once()
        # _request(method, path, data) — all positional
        data = mock.call_args[0][2]
        assert data["device_type"] == "camera"


# ── Story 52: ls ─────────────────────────────────────────────────


class TestListDevices:
    def test_ls_shows_devices_table(self, fleet_runner, mock_request):
        devices = [
            make_device(id="d1", name="cam-1"),
            make_device(id="d2", name="cam-2", status="offline"),
        ]
        mock_request(devices)
        result = fleet_runner.invoke(app, ["fleet", "ls"])
        assert result.exit_code == 0


# ── Story 53: ls --status ────────────────────────────────────────


class TestListDevicesStatusFilter:
    def test_ls_status_filter(self, fleet_runner, mock_request):
        mock = mock_request([make_device(status="offline")])
        fleet_runner.invoke(app, ["fleet", "ls", "--status", "offline"])
        mock.assert_called_once()
        path = mock.call_args[0][1]
        assert "status=offline" in path


# ── Story 54: info ───────────────────────────────────────────────


class TestDeviceInfo:
    def test_info_outputs_json(self, fleet_runner, mock_request):
        device = make_device(id="dev-info-1", name="sensor-3")
        mock_request(device)
        result = fleet_runner.invoke(app, ["fleet", "info", "dev-info-1"])
        assert result.exit_code == 0
        parsed = json.loads(result.output)
        assert parsed["id"] == "dev-info-1"
        assert parsed["name"] == "sensor-3"


# ── Story 55: tag ────────────────────────────────────────────────


class TestTag:
    def test_tag_key_value_pairs(self, fleet_runner, mock_request):
        mock = mock_request({})
        fleet_runner.invoke(app, ["fleet", "tag", "dev-1", "location=warehouse-a", "zone=loading"])
        mock.assert_called_once()
        path = mock.call_args[0][1]
        data = mock.call_args[0][2]
        assert path == "/devices/dev-1/tags"
        assert data == {"location": "warehouse-a", "zone": "loading"}

    def test_tag_invalid_format_exits_1(self, fleet_runner, mock_request):
        mock_request({})
        result = fleet_runner.invoke(app, ["fleet", "tag", "dev-1", "bad-tag-no-equals"])
        assert result.exit_code == 1
        assert "Invalid tag format" in result.output


# ── Story 61: restart ────────────────────────────────────────────


class TestRestart:
    def test_restart_queues_command(self, fleet_runner, mock_request):
        mock_request({"command_id": "cmd-1"})
        result = fleet_runner.invoke(app, ["fleet", "restart", "dev-1"])
        assert result.exit_code == 0
        assert "Restart queued" in result.output


# ── Story 62: decommission ───────────────────────────────────────


class TestDecommission:
    def test_decommission_with_wipe(self, fleet_runner, mock_request):
        mock = mock_request({"id": "dev-1"})
        result = fleet_runner.invoke(app, ["fleet", "decommission", "dev-1", "--wipe"])
        assert result.exit_code == 0
        data = mock.call_args[0][2]
        assert data["wipe_data"] is True


# ── Batch command (field name fix) ───────────────────────────────


class TestBatch:
    def test_batch_sends_action_field(self, fleet_runner, mock_request):
        mock = mock_request({"affected_devices": 5})
        fleet_runner.invoke(app, ["fleet", "batch", "restart", "--tag", "zone=loading"])
        data = mock.call_args[0][2]
        assert data["action"] == "restart"
        assert "command" not in data
