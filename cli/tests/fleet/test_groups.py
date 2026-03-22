"""Tests for fleet group commands (stories 56-57)."""

from __future__ import annotations

from openeye_ai.cli import app
from .conftest import make_device, make_group


class TestGroupCreate:
    def test_group_create(self, fleet_runner, mock_request):
        mock = mock_request({"id": "grp-001"})
        result = fleet_runner.invoke(app, ["fleet", "group-create", "Warehouse A Cameras"])
        assert result.exit_code == 0
        assert "grp-001" in result.output
        data = mock.call_args[0][2]
        assert data["name"] == "Warehouse A Cameras"


class TestGroupAddDevice:
    def test_group_add_device(self, fleet_runner, mock_request):
        mock = mock_request({})
        fleet_runner.invoke(app, ["fleet", "group-add", "grp-001", "dev-001"])
        mock.assert_called_once()
        path = mock.call_args[0][1]
        data = mock.call_args[0][2]
        assert "/groups/grp-001/members" in path
        assert data["device_id"] == "dev-001"


class TestGroupsList:
    def test_groups_list(self, fleet_runner, mock_request):
        mock_request([
            make_group(id="g1", name="Group A"),
            make_group(id="g2", name="Group B"),
        ])
        result = fleet_runner.invoke(app, ["fleet", "groups"])
        assert result.exit_code == 0


class TestGroupMembers:
    def test_group_members_list(self, fleet_runner, mock_request):
        mock_request([
            make_device(id="d1", name="cam-1"),
            make_device(id="d2", name="cam-2"),
        ])
        result = fleet_runner.invoke(app, ["fleet", "group-members", "grp-001"])
        assert result.exit_code == 0
