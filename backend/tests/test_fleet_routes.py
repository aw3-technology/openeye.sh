"""Route-level tests for all Fleet API endpoints using FastAPI TestClient.

All service dependencies are mocked — these tests verify HTTP layer behavior:
status codes, request parsing, error handling, and response shapes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from fleet.app import create_fleet_app


# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture()
def client():
    """TestClient with auth dependencies overridden."""
    app = create_fleet_app()

    # Override auth dependencies to return fixed values
    from fleet.deps import get_current_user_id, get_device_api_key, get_supabase

    app.dependency_overrides[get_current_user_id] = lambda: "user-test-1"
    app.dependency_overrides[get_device_api_key] = lambda: "dev-device-1"
    app.dependency_overrides[get_supabase] = lambda: _FakeSupabase()

    yield TestClient(app, raise_server_exceptions=False)

    app.dependency_overrides.clear()


class _ChainMock(MagicMock):
    """Mock that supports Supabase-style chaining."""

    def __init__(self, data=None, count=None, **kwargs):
        super().__init__(**kwargs)
        self._data = data if data is not None else []
        self._count = count

        # Every chainable method returns self
        def _chain(*args, **kwargs):
            return self

        for method in ("select", "eq", "limit", "order", "insert", "update",
                        "delete", "range", "in_", "lt", "neq", "gt", "gte",
                        "lte", "is_", "like", "ilike"):
            setattr(self, method, _chain)

        result = MagicMock()
        result.data = self._data
        result.count = self._count
        self.execute = MagicMock(return_value=result)


class _FakeSupabase:
    """Fake Supabase client that returns predictable data."""

    def __init__(self):
        self._overrides: dict[str, list[_ChainMock]] = {}

    def override(self, table: str, mock: _ChainMock):
        self._overrides.setdefault(table, []).append(mock)

    def table(self, name: str) -> _ChainMock:
        mocks = self._overrides.get(name, [])
        if mocks:
            return mocks.pop(0) if len(mocks) > 1 else mocks[0]
        return _ChainMock()


def _device_row(**overrides) -> dict:
    base = {
        "id": "dev-001",
        "user_id": "user-test-1",
        "name": "cam-1",
        "device_type": "camera",
        "status": "online",
        "api_key": None,
        "api_key_hash": None,
        "hardware_specs": {},
        "tags": {},
        "config_overrides": {},
        "firmware_version": "1.0.0",
        "current_model_id": None,
        "current_model_version": None,
        "ip_address": "10.0.0.1",
        "last_heartbeat_at": "2025-01-01T00:00:00Z",
        "registered_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


def _deployment_row(**overrides) -> dict:
    base = {
        "id": "dep-001",
        "user_id": "user-test-1",
        "name": "yolov8-2.1",
        "model_id": "yolov8",
        "model_version": "2.1",
        "strategy": "canary",
        "status": "pending",
        "rollout_stages": [],
        "current_stage": 0,
        "target_device_ids": [],
        "target_group_id": None,
        "model_url": None,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


def _group_row(**overrides) -> dict:
    base = {
        "id": "grp-001",
        "user_id": "user-test-1",
        "name": "Warehouse A",
        "description": "",
        "tag_filter": {},
        "auto_scaling_policy": None,
        "device_count": 0,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


# ── Health ───────────────────────────────────────────────────────────


class TestHealth:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        assert resp.json()["service"] == "fleet-control-plane"


# ── Device Routes ────────────────────────────────────────────────────


class TestDeviceRoutes:
    @patch("fleet.routers.devices.DeviceService")
    def test_register_device(self, mock_svc_cls, client):
        mock_svc_cls.return_value.register.return_value = _device_row()
        resp = client.post("/devices", json={"name": "cam-1", "device_type": "camera"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "cam-1"

    @patch("fleet.routers.devices.DeviceService")
    def test_list_devices(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_devices.return_value = [_device_row(), _device_row(id="dev-002")]
        resp = client.get("/devices")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    @patch("fleet.routers.devices.DeviceService")
    def test_list_devices_with_filters(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_devices.return_value = []
        resp = client.get("/devices?status=offline&device_type=camera&limit=50&offset=10")
        assert resp.status_code == 200
        call_args = mock_svc_cls.return_value.list_devices.call_args
        assert call_args[0][1] == "offline"
        assert call_args[0][2] == "camera"

    @patch("fleet.routers.devices.DeviceService")
    def test_get_device_success(self, mock_svc_cls, client):
        mock_svc_cls.return_value.get_device.return_value = _device_row()
        resp = client.get("/devices/dev-001")
        assert resp.status_code == 200
        assert resp.json()["id"] == "dev-001"

    @patch("fleet.routers.devices.DeviceService")
    def test_get_device_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.get_device.side_effect = KeyError("not found")
        resp = client.get("/devices/dev-missing")
        assert resp.status_code == 404

    @patch("fleet.routers.devices.DeviceService")
    def test_update_device(self, mock_svc_cls, client):
        mock_svc_cls.return_value.update_device.return_value = _device_row(name="updated")
        resp = client.patch("/devices/dev-001", json={"name": "updated"})
        assert resp.status_code == 200

    @patch("fleet.routers.devices.DeviceService")
    def test_update_device_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.update_device.side_effect = KeyError("not found")
        resp = client.patch("/devices/dev-missing", json={"name": "x"})
        assert resp.status_code == 404

    @patch("fleet.routers.devices.DeviceService")
    def test_set_tags(self, mock_svc_cls, client):
        mock_svc_cls.return_value.set_tags.return_value = _device_row(tags={"env": "prod"})
        resp = client.put("/devices/dev-001/tags", json={"env": "prod"})
        assert resp.status_code == 200

    @patch("fleet.routers.devices.DeviceService")
    def test_set_tags_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.set_tags.side_effect = KeyError("not found")
        resp = client.put("/devices/dev-missing/tags", json={"a": "b"})
        assert resp.status_code == 404

    @patch("fleet.routers.devices.DeviceService")
    def test_set_config_overrides(self, mock_svc_cls, client):
        mock_svc_cls.return_value.set_config_overrides.return_value = _device_row()
        resp = client.put("/devices/dev-001/config", json={"key": "val"})
        assert resp.status_code == 200

    @patch("fleet.services.heartbeat_service.HeartbeatService")
    def test_get_resource_history(self, mock_hb_cls, client):
        mock_hb_cls.return_value.get_resource_history.return_value = [{"cpu_percent": 50}]
        resp = client.get("/devices/dev-001/resources?limit=10")
        assert resp.status_code == 200

    @patch("fleet.routers.devices.CommandService")
    @patch("fleet.routers.devices.DeviceService")
    def test_restart_device(self, mock_dev_cls, mock_cmd_cls, client):
        mock_dev_cls.return_value.get_device.return_value = _device_row()
        mock_cmd_cls.return_value.enqueue.return_value = {"id": "cmd-1"}
        resp = client.post("/devices/dev-001/restart")
        assert resp.status_code == 202
        assert resp.json()["command_id"] == "cmd-1"

    @patch("fleet.routers.devices.DeviceService")
    def test_decommission_device(self, mock_svc_cls, client):
        mock_svc_cls.return_value.decommission.return_value = _device_row(status="decommissioned")
        resp = client.request("DELETE", "/devices/dev-001", json={"reason": "old", "wipe_data": False})
        assert resp.status_code == 200

    @patch("fleet.routers.devices.DeviceService")
    def test_decommission_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.decommission.side_effect = KeyError("not found")
        resp = client.request("DELETE", "/devices/dev-missing")
        assert resp.status_code == 404

    @patch("fleet.routers.devices.CommandService")
    @patch("fleet.routers.devices.DeviceService")
    def test_batch_operation(self, mock_dev_cls, mock_cmd_cls, client):
        mock_dev_cls.return_value.get_devices_by_tags.return_value = [{"id": "d1"}, {"id": "d2"}]
        mock_cmd_cls.return_value.enqueue.return_value = {"id": "cmd-x"}
        resp = client.post("/devices/batch", json={
            "action": "restart",
            "tag_filter": {"zone": "a"},
        })
        assert resp.status_code == 200
        assert resp.json()["matched"] == 2

    @patch("fleet.routers.devices.DeviceService")
    def test_batch_no_matching_devices(self, mock_dev_cls, client):
        mock_dev_cls.return_value.get_devices_by_tags.return_value = []
        resp = client.post("/devices/batch", json={
            "action": "restart",
            "tag_filter": {"zone": "nonexistent"},
        })
        assert resp.status_code == 404

    def test_batch_invalid_action(self, client):
        resp = client.post("/devices/batch", json={
            "action": "invalid_action",
            "tag_filter": {"zone": "a"},
        })
        assert resp.status_code == 422


# ── Heartbeat Routes ─────────────────────────────────────────────────


class TestHeartbeatRoutes:
    @patch("fleet.routers.heartbeats.HeartbeatService")
    def test_receive_heartbeat(self, mock_svc_cls, client):
        mock_svc_cls.return_value.process_heartbeat.return_value = [
            {"id": "cmd-1", "command_type": "restart", "payload": {}},
        ]
        resp = client.post(
            "/heartbeats",
            json={"device_id": "dev-device-1"},
            headers={"X-Device-API-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "server_time" in data
        assert len(data["pending_commands"]) == 1

    @patch("fleet.routers.heartbeats.HeartbeatService")
    def test_receive_heartbeat_no_pending(self, mock_svc_cls, client):
        mock_svc_cls.return_value.process_heartbeat.return_value = []
        resp = client.post(
            "/heartbeats",
            json={"device_id": "dev-device-1"},
            headers={"X-Device-API-Key": "test-key"},
        )
        assert resp.status_code == 200
        assert resp.json()["pending_commands"] == []


# ── Deployment Routes ────────────────────────────────────────────────


class TestDeploymentRoutes:
    @patch("fleet.routers.deployments.DeploymentService")
    def test_create_deployment(self, mock_svc_cls, client):
        mock_svc_cls.return_value.create.return_value = _deployment_row()
        resp = client.post("/deployments", json={
            "name": "test-deploy",
            "model_id": "yolov8",
            "model_version": "2.1",
            "strategy": "canary",
        })
        assert resp.status_code == 201
        assert resp.json()["id"] == "dep-001"

    @patch("fleet.routers.deployments.DeploymentService")
    def test_list_deployments(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_deployments.return_value = [_deployment_row()]
        resp = client.get("/deployments")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @patch("fleet.routers.deployments.DeploymentService")
    def test_list_deployments_with_status(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_deployments.return_value = []
        resp = client.get("/deployments?status=completed")
        assert resp.status_code == 200
        mock_svc_cls.return_value.list_deployments.assert_called_once_with("user-test-1", "completed")

    @patch("fleet.routers.deployments.DeploymentService")
    def test_get_deployment(self, mock_svc_cls, client):
        mock_svc_cls.return_value.get_deployment.return_value = _deployment_row()
        resp = client.get("/deployments/dep-001")
        assert resp.status_code == 200

    @patch("fleet.routers.deployments.DeploymentService")
    def test_get_deployment_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.get_deployment.side_effect = KeyError("not found")
        resp = client.get("/deployments/dep-missing")
        assert resp.status_code == 404

    @patch("fleet.routers.deployments.DeploymentService")
    def test_get_deployment_devices(self, mock_svc_cls, client):
        mock_svc_cls.return_value.get_device_statuses.return_value = [
            {"id": "dds-1", "deployment_id": "dep-001", "device_id": "d1",
             "status": "success", "stage": 0, "progress": 1.0,
             "error_message": None, "started_at": None, "completed_at": None},
        ]
        resp = client.get("/deployments/dep-001/devices")
        assert resp.status_code == 200

    @patch("fleet.routers.deployments.DeploymentService")
    def test_advance_deployment(self, mock_svc_cls, client):
        mock_svc_cls.return_value.advance_stage.return_value = _deployment_row(current_stage=1)
        resp = client.post("/deployments/dep-001/advance")
        assert resp.status_code == 200

    @patch("fleet.routers.deployments.DeploymentService")
    def test_advance_deployment_error(self, mock_svc_cls, client):
        mock_svc_cls.return_value.advance_stage.side_effect = ValueError("Already completed")
        resp = client.post("/deployments/dep-001/advance")
        assert resp.status_code == 400

    @patch("fleet.routers.deployments.DeploymentService")
    def test_pause_deployment(self, mock_svc_cls, client):
        mock_svc_cls.return_value.pause.return_value = _deployment_row(status="paused")
        resp = client.post("/deployments/dep-001/pause")
        assert resp.status_code == 200

    @patch("fleet.routers.deployments.DeploymentService")
    def test_pause_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.pause.side_effect = KeyError("not found")
        resp = client.post("/deployments/dep-missing/pause")
        assert resp.status_code == 404

    @patch("fleet.routers.deployments.DeploymentService")
    def test_rollback_deployment(self, mock_svc_cls, client):
        mock_svc_cls.return_value.rollback.return_value = _deployment_row(status="rolled_back")
        resp = client.post("/deployments/dep-001/rollback")
        assert resp.status_code == 200

    @patch("fleet.routers.deployments.DeploymentService")
    def test_rollback_error(self, mock_svc_cls, client):
        mock_svc_cls.return_value.rollback.side_effect = ValueError("Cannot rollback")
        resp = client.post("/deployments/dep-001/rollback")
        assert resp.status_code == 400


# ── Device Group Routes ──────────────────────────────────────────────


class TestDeviceGroupRoutes:
    def test_create_group(self, client):
        """Group creation goes directly to Supabase (no service)."""
        app = client.app
        sb = _FakeSupabase()
        sb.override("device_groups", _ChainMock(data=[_group_row()]))
        from fleet.deps import get_supabase
        app.dependency_overrides[get_supabase] = lambda: sb

        resp = client.post("/groups", json={"name": "Test Group"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "Warehouse A"

    def test_create_group_empty_name(self, client):
        resp = client.post("/groups", json={"name": "  "})
        assert resp.status_code == 422

    def test_list_groups(self, client):
        app = client.app
        sb = _FakeSupabase()
        sb.override("device_groups", _ChainMock(data=[_group_row()]))
        sb.override("device_group_members", _ChainMock(data=[], count=3))
        from fleet.deps import get_supabase
        app.dependency_overrides[get_supabase] = lambda: sb

        resp = client.get("/groups")
        assert resp.status_code == 200

    def test_get_group_not_found(self, client):
        app = client.app
        sb = _FakeSupabase()
        sb.override("device_groups", _ChainMock(data=[]))
        from fleet.deps import get_supabase
        app.dependency_overrides[get_supabase] = lambda: sb

        resp = client.get("/groups/grp-missing")
        assert resp.status_code == 404

    def test_delete_group_not_found(self, client):
        app = client.app
        sb = _FakeSupabase()
        sb.override("device_groups", _ChainMock(data=[]))
        from fleet.deps import get_supabase
        app.dependency_overrides[get_supabase] = lambda: sb

        resp = client.delete("/groups/grp-missing")
        assert resp.status_code == 404

    def test_delete_group_with_active_deployments(self, client):
        app = client.app
        sb = _FakeSupabase()
        sb.override("device_groups", _ChainMock(data=[{"id": "grp-1"}]))
        sb.override("deployments", _ChainMock(data=[], count=2))
        from fleet.deps import get_supabase
        app.dependency_overrides[get_supabase] = lambda: sb

        resp = client.delete("/groups/grp-1")
        assert resp.status_code == 409

    def test_add_member_group_not_found(self, client):
        app = client.app
        sb = _FakeSupabase()
        sb.override("device_groups", _ChainMock(data=[]))
        from fleet.deps import get_supabase
        app.dependency_overrides[get_supabase] = lambda: sb

        resp = client.post("/groups/grp-missing/members?device_id=dev-1")
        assert resp.status_code == 404

    def test_list_members_group_not_found(self, client):
        app = client.app
        sb = _FakeSupabase()
        sb.override("device_groups", _ChainMock(data=[]))
        from fleet.deps import get_supabase
        app.dependency_overrides[get_supabase] = lambda: sb

        resp = client.get("/groups/grp-missing/members")
        assert resp.status_code == 404

    def test_set_scaling_not_found(self, client):
        app = client.app
        sb = _FakeSupabase()
        sb.override("device_groups", _ChainMock(data=[]))
        from fleet.deps import get_supabase
        app.dependency_overrides[get_supabase] = lambda: sb

        resp = client.put("/groups/grp-missing/scaling", json={
            "enabled": True,
            "min_devices": 1,
            "max_devices": 10,
            "target_cpu_percent": 70.0,
        })
        assert resp.status_code == 404


# ── Alert Routes ─────────────────────────────────────────────────────


class TestAlertRoutes:
    @patch("fleet.routers.alerts.AlertService")
    def test_list_alerts(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_alerts.return_value = [
            {"id": "a1", "user_id": "user-test-1", "device_id": "d1",
             "deployment_id": None, "alert_type": "device_offline",
             "severity": "warning", "title": "Offline", "message": "msg",
             "resolved": False, "resolved_at": None,
             "created_at": "2025-01-01T00:00:00Z"},
        ]
        resp = client.get("/alerts")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @patch("fleet.routers.alerts.AlertService")
    def test_list_alerts_with_filters(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_alerts.return_value = []
        resp = client.get("/alerts?resolved=true&severity=critical")
        assert resp.status_code == 200
        mock_svc_cls.return_value.list_alerts.assert_called_once_with(
            "user-test-1", True, "critical",
        )

    @patch("fleet.routers.alerts.AlertService")
    def test_resolve_alert(self, mock_svc_cls, client):
        mock_svc_cls.return_value.resolve_alert.return_value = {
            "id": "a1", "user_id": "user-test-1", "device_id": "d1",
            "deployment_id": None, "alert_type": "device_offline",
            "severity": "warning", "title": "Offline", "message": "msg",
            "resolved": True, "resolved_at": "2025-01-02T00:00:00Z",
            "created_at": "2025-01-01T00:00:00Z",
        }
        resp = client.post("/alerts/a1/resolve")
        assert resp.status_code == 200
        assert resp.json()["resolved"] is True

    @patch("fleet.routers.alerts.AlertService")
    def test_resolve_alert_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.resolve_alert.side_effect = KeyError("not found")
        resp = client.post("/alerts/a-missing/resolve")
        assert resp.status_code == 404


# ── Command Routes ───────────────────────────────────────────────────


class TestCommandRoutes:
    @patch("fleet.routers.commands.CommandService")
    def test_list_commands(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_commands.return_value = [
            {"id": "cmd-1", "command_type": "restart", "status": "pending"},
        ]
        resp = client.get("/commands")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @patch("fleet.routers.commands.CommandService")
    def test_list_commands_with_filters(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_commands.return_value = []
        resp = client.get("/commands?device_id=dev-1&status=completed")
        assert resp.status_code == 200
        mock_svc_cls.return_value.list_commands.assert_called_once_with(
            "user-test-1", "dev-1", "completed",
        )

    @patch("fleet.routers.commands.CommandService")
    def test_complete_command(self, mock_svc_cls, client):
        mock_svc_cls.return_value.complete_command.return_value = {
            "id": "cmd-1", "status": "completed",
        }
        resp = client.post("/commands/cmd-1/complete", json={"status": "done"})
        assert resp.status_code == 200

    @patch("fleet.routers.commands.CommandService")
    def test_complete_command_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.complete_command.side_effect = KeyError("not found")
        resp = client.post("/commands/cmd-missing/complete")
        assert resp.status_code == 404

    @patch("fleet.routers.commands.CommandService")
    def test_device_complete_command(self, mock_svc_cls, client):
        mock_svc_cls.return_value.device_complete_command.return_value = {
            "id": "cmd-1", "status": "completed",
        }
        resp = client.post(
            "/commands/cmd-1/device-complete",
            json={"status": "done"},
            headers={"X-Device-API-Key": "test-key"},
        )
        assert resp.status_code == 200

    @patch("fleet.routers.commands.CommandService")
    def test_device_complete_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.device_complete_command.side_effect = KeyError("not found")
        resp = client.post(
            "/commands/cmd-missing/device-complete",
            headers={"X-Device-API-Key": "test-key"},
        )
        assert resp.status_code == 404


# ── Maintenance Routes ───────────────────────────────────────────────


class TestMaintenanceRoutes:
    @patch("fleet.routers.maintenance.MaintenanceService")
    def test_create_maintenance(self, mock_svc_cls, client):
        mock_svc_cls.return_value.create.return_value = {
            "id": "maint-1", "user_id": "user-test-1", "name": "Window",
            "description": "", "device_ids": [], "group_id": None,
            "starts_at": "2025-06-01T02:00:00Z", "ends_at": "2025-06-01T04:00:00Z",
            "recurrence": None, "is_active": True, "status": "upcoming",
            "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z",
        }
        resp = client.post("/maintenance", json={
            "name": "Window",
            "starts_at": "2025-06-01T02:00:00Z",
            "ends_at": "2025-06-01T04:00:00Z",
        })
        assert resp.status_code == 201

    @patch("fleet.routers.maintenance.MaintenanceService")
    def test_list_maintenance(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_windows.return_value = []
        resp = client.get("/maintenance")
        assert resp.status_code == 200

    @patch("fleet.routers.maintenance.MaintenanceService")
    def test_list_maintenance_active_only(self, mock_svc_cls, client):
        mock_svc_cls.return_value.list_windows.return_value = []
        resp = client.get("/maintenance?active_only=true")
        assert resp.status_code == 200
        mock_svc_cls.return_value.list_windows.assert_called_once_with("user-test-1", True)

    @patch("fleet.routers.maintenance.MaintenanceService")
    def test_get_maintenance(self, mock_svc_cls, client):
        mock_svc_cls.return_value.get_window.return_value = {
            "id": "maint-1", "user_id": "user-test-1", "name": "Window",
            "description": "", "device_ids": [], "group_id": None,
            "starts_at": "2025-06-01T02:00:00Z", "ends_at": "2025-06-01T04:00:00Z",
            "recurrence": None, "is_active": True, "status": "upcoming",
            "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z",
        }
        resp = client.get("/maintenance/maint-1")
        assert resp.status_code == 200

    @patch("fleet.routers.maintenance.MaintenanceService")
    def test_get_maintenance_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.get_window.side_effect = KeyError("not found")
        resp = client.get("/maintenance/maint-missing")
        assert resp.status_code == 404

    @patch("fleet.routers.maintenance.MaintenanceService")
    def test_update_maintenance(self, mock_svc_cls, client):
        mock_svc_cls.return_value.update_window.return_value = {
            "id": "maint-1", "user_id": "user-test-1", "name": "Updated",
            "description": "", "device_ids": [], "group_id": None,
            "starts_at": "2025-06-01T02:00:00Z", "ends_at": "2025-06-01T04:00:00Z",
            "recurrence": None, "is_active": True, "status": "upcoming",
            "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z",
        }
        resp = client.patch("/maintenance/maint-1", json={"name": "Updated"})
        assert resp.status_code == 200

    @patch("fleet.routers.maintenance.MaintenanceService")
    def test_update_maintenance_empty_body(self, mock_svc_cls, client):
        resp = client.patch("/maintenance/maint-1", json={})
        assert resp.status_code == 400

    @patch("fleet.routers.maintenance.MaintenanceService")
    def test_update_not_found(self, mock_svc_cls, client):
        mock_svc_cls.return_value.update_window.side_effect = KeyError("not found")
        resp = client.patch("/maintenance/maint-missing", json={"name": "x"})
        assert resp.status_code == 404

    @patch("fleet.routers.maintenance.MaintenanceService")
    def test_delete_maintenance(self, mock_svc_cls, client):
        mock_svc_cls.return_value.delete_window.return_value = None
        resp = client.delete("/maintenance/maint-1")
        assert resp.status_code == 204


# ── OTA Routes ───────────────────────────────────────────────────────


class TestOTARoutes:
    @patch("fleet.routers.ota.OTAService")
    def test_push_ota_update(self, mock_svc_cls, client):
        mock_svc_cls.return_value.push_update.return_value = [{"id": "cmd-1"}, {"id": "cmd-2"}]
        resp = client.post("/ota/update", json={
            "device_ids": ["dev-1", "dev-2"],
            "firmware_url": "https://example.com/fw.bin",
            "firmware_version": "2.0.0",
            "checksum": "abc123" * 10 + "abcd",
        })
        assert resp.status_code == 202
        assert resp.json()["command_count"] == 2

    @patch("fleet.routers.ota.OTAService")
    def test_push_ota_permission_error(self, mock_svc_cls, client):
        mock_svc_cls.return_value.push_update.side_effect = PermissionError("Not allowed")
        resp = client.post("/ota/update", json={
            "device_ids": ["dev-1"],
            "firmware_url": "https://example.com/fw.bin",
            "firmware_version": "2.0.0",
            "checksum": "abc123" * 10 + "abcd",
        })
        assert resp.status_code == 403
