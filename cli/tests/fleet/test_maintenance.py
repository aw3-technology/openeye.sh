"""Tests for fleet maintenance commands (story 65)."""

from __future__ import annotations

from openeye_ai.cli import app
from .conftest import make_maintenance


class TestMaintenanceCreate:
    def test_maintenance_create_with_group(self, fleet_runner, mock_request):
        mock = mock_request({"id": "maint-001"})
        result = fleet_runner.invoke(app, [
            "fleet", "maintenance-create",
            "--name", "Nightly Update",
            "--start", "2025-06-01T02:00:00Z",
            "--end", "2025-06-01T04:00:00Z",
            "--group", "grp-001",
        ])
        assert result.exit_code == 0
        payload = mock.call_args[0][2]
        assert payload["starts_at"] == "2025-06-01T02:00:00Z"
        assert payload["ends_at"] == "2025-06-01T04:00:00Z"
        assert payload["group_id"] == "grp-001"
        assert "start_time" not in payload
        assert "end_time" not in payload

    def test_maintenance_create_with_devices(self, fleet_runner, mock_request):
        mock = mock_request({"id": "maint-002"})
        result = fleet_runner.invoke(app, [
            "fleet", "maintenance-create",
            "--name", "Firmware Patch",
            "--start", "2025-06-01T02:00:00Z",
            "--end", "2025-06-01T04:00:00Z",
            "--devices", "dev-1,dev-2,dev-3",
        ])
        assert result.exit_code == 0
        payload = mock.call_args[0][2]
        assert payload["device_ids"] == ["dev-1", "dev-2", "dev-3"]


class TestMaintenanceList:
    def test_maintenance_list(self, fleet_runner, mock_request):
        mock_request([
            make_maintenance(id="m1", name="Window A"),
            make_maintenance(id="m2", name="Window B"),
        ])
        result = fleet_runner.invoke(app, ["fleet", "maintenance-list"])
        assert result.exit_code == 0
