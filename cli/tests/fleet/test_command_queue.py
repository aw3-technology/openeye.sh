"""Tests for fleet command queue and agent CLI commands."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from openeye_ai.cli import app
from .conftest import make_device


class TestCommandQueue:
    def test_commands_list_no_filters(self, fleet_runner, mock_request):
        commands = [
            {"id": "cmd-1", "device_id": "dev-1", "command_type": "restart",
             "status": "pending", "created_at": "2025-01-01T00:00:00Z"},
            {"id": "cmd-2", "device_id": "dev-2", "command_type": "deploy_model",
             "status": "completed", "created_at": "2025-01-01T01:00:00Z"},
        ]
        mock_request(commands)
        result = fleet_runner.invoke(app, ["fleet", "commands"])
        assert result.exit_code == 0

    def test_commands_list_with_device_filter(self, fleet_runner, mock_request):
        mock = mock_request([])
        fleet_runner.invoke(app, ["fleet", "commands", "--device", "dev-1"])
        params = mock.call_args[1].get("params", {})
        assert params.get("device_id") == "dev-1"

    def test_commands_list_with_status_filter(self, fleet_runner, mock_request):
        mock = mock_request([])
        fleet_runner.invoke(app, ["fleet", "commands", "--status", "failed"])
        params = mock.call_args[1].get("params", {})
        assert params.get("status") == "failed"

    def test_commands_list_empty(self, fleet_runner, mock_request):
        mock_request([])
        result = fleet_runner.invoke(app, ["fleet", "commands"])
        assert result.exit_code == 0
        assert "No commands" in result.output


class TestOTACommand:
    def test_ota_basic(self, fleet_runner, mock_request):
        mock = mock_request({"id": "ota-1", "target_count": 5})
        result = fleet_runner.invoke(app, [
            "fleet", "ota",
            "--url", "https://example.com/fw.bin",
            "--version", "2.0.0",
        ])
        assert result.exit_code == 0
        payload = mock.call_args[0][2]
        assert payload["firmware_url"] == "https://example.com/fw.bin"
        assert payload["version"] == "2.0.0"
        assert payload["force"] is False

    def test_ota_with_group(self, fleet_runner, mock_request):
        mock = mock_request({"id": "ota-2", "target_count": 3})
        fleet_runner.invoke(app, [
            "fleet", "ota",
            "--url", "https://example.com/fw.bin",
            "--version", "2.0.0",
            "--group", "grp-1",
        ])
        payload = mock.call_args[0][2]
        assert payload["target_group_id"] == "grp-1"

    def test_ota_with_device_ids(self, fleet_runner, mock_request):
        mock = mock_request({"id": "ota-3", "target_count": 2})
        fleet_runner.invoke(app, [
            "fleet", "ota",
            "--url", "https://example.com/fw.bin",
            "--version", "2.0.0",
            "--devices", "dev-1,dev-2",
        ])
        payload = mock.call_args[0][2]
        assert payload["target_device_ids"] == ["dev-1", "dev-2"]

    def test_ota_force_flag(self, fleet_runner, mock_request):
        mock = mock_request({"id": "ota-4", "target_count": 1})
        fleet_runner.invoke(app, [
            "fleet", "ota",
            "--url", "https://example.com/fw.bin",
            "--version", "2.0.0",
            "--force",
        ])
        payload = mock.call_args[0][2]
        assert payload["force"] is True


class TestAdvanceAndPause:
    def test_advance_deployment(self, fleet_runner, mock_request):
        mock = mock_request({"current_stage": 2})
        result = fleet_runner.invoke(app, ["fleet", "advance", "dep-001"])
        assert result.exit_code == 0
        assert "/deployments/dep-001/advance" in mock.call_args[0][1]

    def test_pause_deployment(self, fleet_runner, mock_request):
        mock = mock_request({"status": "paused"})
        result = fleet_runner.invoke(app, ["fleet", "pause-deployment", "dep-001"])
        assert result.exit_code == 0
        assert "/deployments/dep-001/pause" in mock.call_args[0][1]


class TestConfigOverride:
    def test_config_valid_json(self, fleet_runner, mock_request):
        mock = mock_request({})
        result = fleet_runner.invoke(app, ["fleet", "config", "dev-1", '{"threshold": 0.5}'])
        assert result.exit_code == 0
        data = mock.call_args[0][2]
        assert data == {"threshold": 0.5}

    def test_config_invalid_json(self, fleet_runner, mock_request):
        mock_request({})
        result = fleet_runner.invoke(app, ["fleet", "config", "dev-1", "not-json"])
        assert result.exit_code == 1
        assert "Invalid JSON" in result.output


class TestResources:
    def test_resources_with_data(self, fleet_runner, mock_request):
        mock = mock_request([
            {"timestamp": "2025-01-01T00:00:00Z", "cpu_percent": 45.2,
             "memory_percent": 60.0, "disk_percent": 30.0,
             "inference_rate": 12, "gpu_percent": 80.0},
        ])
        result = fleet_runner.invoke(app, ["fleet", "resources", "dev-1"])
        assert result.exit_code == 0

    def test_resources_empty(self, fleet_runner, mock_request):
        mock_request([])
        result = fleet_runner.invoke(app, ["fleet", "resources", "dev-1"])
        assert result.exit_code == 0
        assert "No resource data" in result.output

    def test_resources_custom_limit(self, fleet_runner, mock_request):
        mock = mock_request([])
        fleet_runner.invoke(app, ["fleet", "resources", "dev-1", "--limit", "50"])
        params = mock.call_args[1].get("params", {})
        assert params.get("limit") == 50


class TestGroupScaling:
    def test_group_scaling_enabled(self, fleet_runner, mock_request):
        mock = mock_request({})
        result = fleet_runner.invoke(app, [
            "fleet", "group-scaling", "grp-1",
            "--min", "2", "--max", "20", "--target-cpu", "80",
        ])
        assert result.exit_code == 0
        data = mock.call_args[0][2]
        assert data["enabled"] is True
        assert data["min_devices"] == 2
        assert data["max_devices"] == 20
        assert data["target_cpu_percent"] == 80.0

    def test_group_scaling_disabled(self, fleet_runner, mock_request):
        mock = mock_request({})
        result = fleet_runner.invoke(app, [
            "fleet", "group-scaling", "grp-1", "--disabled",
        ])
        assert result.exit_code == 0
        data = mock.call_args[0][2]
        assert data["enabled"] is False


class TestGroupRemove:
    def test_group_remove_device(self, fleet_runner, mock_request):
        mock = mock_request({})
        result = fleet_runner.invoke(app, ["fleet", "group-remove", "grp-1", "dev-1"])
        assert result.exit_code == 0
        assert "/groups/grp-1/members/dev-1" in mock.call_args[0][1]


class TestAgentCommand:
    def test_agent_missing_api_key(self, fleet_runner, mock_request):
        mock_request({})
        result = fleet_runner.invoke(app, [
            "fleet", "agent", "--device-id", "dev-1",
        ])
        assert result.exit_code == 1
        assert "API key is required" in result.output

    def test_agent_invalid_server_url(self, fleet_runner, mock_request):
        mock_request({})
        result = fleet_runner.invoke(app, [
            "fleet", "agent",
            "--device-id", "dev-1",
            "--api-key", "test-key",
            "--server", "not-a-url",
        ])
        assert result.exit_code == 1
        assert "http://" in result.output

    def test_agent_invalid_interval(self, fleet_runner, mock_request):
        mock_request({})
        result = fleet_runner.invoke(app, [
            "fleet", "agent",
            "--device-id", "dev-1",
            "--api-key", "test-key",
            "--interval", "0.5",
        ])
        assert result.exit_code == 1
        assert "at least 1 second" in result.output


class TestDeployWithModelURL:
    def test_deploy_with_model_url(self, fleet_runner, mock_request):
        mock = mock_request({"id": "dep-url-1"})
        result = fleet_runner.invoke(app, [
            "fleet", "deploy",
            "--model", "yolov8",
            "--version", "3.0",
            "--url", "https://example.com/model.pt",
        ])
        assert result.exit_code == 0
        payload = mock.call_args[0][2]
        assert payload["model_url"] == "https://example.com/model.pt"


class TestListDevicesTypeFilter:
    def test_ls_type_filter(self, fleet_runner, mock_request):
        mock = mock_request([make_device(device_type="camera")])
        fleet_runner.invoke(app, ["fleet", "ls", "--type", "camera"])
        params = mock.call_args[1].get("params", {})
        assert params.get("device_type") == "camera"
