"""Tests for fleet deployment commands (stories 58-60)."""

from __future__ import annotations

from openeye_ai.cli import app
from .conftest import make_deployment


class TestDeploy:
    def test_deploy_canary_with_group(self, fleet_runner, mock_request):
        mock = mock_request({"id": "dep-001"})
        result = fleet_runner.invoke(app, [
            "fleet", "deploy",
            "--model", "yolov8",
            "--version", "2.1",
            "--strategy", "canary",
            "--group", "grp-001",
            "--name", "my-deploy",
        ])
        assert result.exit_code == 0
        payload = mock.call_args[0][2]
        assert payload["strategy"] == "canary"
        assert payload["target_group_id"] == "grp-001"

    def test_deploy_rolling(self, fleet_runner, mock_request):
        mock = mock_request({"id": "dep-002"})
        result = fleet_runner.invoke(app, [
            "fleet", "deploy",
            "--model", "yolov8",
            "--version", "2.1",
            "--strategy", "rolling",
            "--name", "rolling-deploy",
        ])
        assert result.exit_code == 0
        payload = mock.call_args[0][2]
        assert payload["strategy"] == "rolling"

    def test_deploy_auto_name(self, fleet_runner, mock_request):
        mock = mock_request({"id": "dep-003"})
        result = fleet_runner.invoke(app, [
            "fleet", "deploy",
            "--model", "yolov8",
            "--version", "2.1",
        ])
        assert result.exit_code == 0
        payload = mock.call_args[0][2]
        assert payload["name"] == "yolov8-2.1"

    def test_deploy_invalid_strategy_exits_1(self, fleet_runner, mock_request):
        mock_request({})
        result = fleet_runner.invoke(app, [
            "fleet", "deploy",
            "--model", "yolov8",
            "--version", "2.1",
            "--strategy", "bogus",
        ])
        assert result.exit_code == 1
        assert "Invalid strategy" in result.output


class TestRollback:
    def test_rollback(self, fleet_runner, mock_request):
        mock = mock_request({"status": "rolling_back"})
        result = fleet_runner.invoke(app, ["fleet", "rollback", "dep-001"])
        assert result.exit_code == 0
        mock.assert_called_once()
        assert "/deployments/dep-001/rollback" in mock.call_args[0][1]
