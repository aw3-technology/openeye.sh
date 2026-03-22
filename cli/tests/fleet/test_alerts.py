"""Tests for fleet alert commands (stories 63-64)."""

from __future__ import annotations

from openeye_ai.cli import app
from .conftest import make_alert


class TestAlertsList:
    def test_alerts_list(self, fleet_runner, mock_request):
        mock_request([
            make_alert(severity="critical", alert_type="device_offline", title="cam-1 offline"),
            make_alert(severity="warning", alert_type="high_resource_usage", title="High CPU"),
        ])
        result = fleet_runner.invoke(app, ["fleet", "alerts"])
        assert result.exit_code == 0

    def test_alerts_defaults_unresolved(self, fleet_runner, mock_request):
        mock = mock_request([make_alert()])
        fleet_runner.invoke(app, ["fleet", "alerts"])
        call_args = mock.call_args
        # Default invocation should NOT pass resolved= query param
        assert "resolved=" not in call_args[0][1]


class TestResolveAlert:
    def test_resolve_alert(self, fleet_runner, mock_request):
        mock = mock_request({})
        result = fleet_runner.invoke(app, ["fleet", "resolve-alert", "alert-001"])
        assert result.exit_code == 0
        assert "/alerts/alert-001/resolve" in mock.call_args[0][1]
