"""Tests for HeartbeatService and CommandService (Stories 66 + 68)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from fleet.models import DeviceStatus, HeartbeatRequest
from fleet.services.command_service import CommandService
from fleet.services.heartbeat_service import HeartbeatService


# ── Helpers ─────────────────────────────────────────────────────────


def _chainable_mock(data=None, error=None):
    """Return a MagicMock that supports query-builder-style method chaining.

    Every chained method (.select(), .eq(), .limit(), .order(), .lt(), .insert(),
    .update()) returns the same mock, and .execute() returns an object whose
    .data attribute is *data*.
    """
    m = MagicMock()
    m.select.return_value = m
    m.eq.return_value = m
    m.limit.return_value = m
    m.order.return_value = m
    m.lt.return_value = m
    m.insert.return_value = m
    m.update.return_value = m

    result = MagicMock()
    result.data = data if data is not None else []
    m.execute.return_value = result
    return m


class _FakeDB:
    """Minimal database client double that returns different chainable mocks
    for each call to .table()."""

    def __init__(self):
        self._calls: list[MagicMock] = []
        self._table_map: dict[str, list[MagicMock]] = {}

    def add(self, table_name: str, mock: MagicMock) -> None:
        self._table_map.setdefault(table_name, []).append(mock)

    def table(self, name: str) -> MagicMock:
        mocks = self._table_map.get(name, [])
        if not mocks:
            return _chainable_mock()
        # Pop from front so each successive .table(name) call gets the next mock
        return mocks.pop(0) if len(mocks) > 1 else mocks[0]


# ── HeartbeatService ───────────────────────────────────────────────


class TestHeartbeatService:
    def test_process_heartbeat_success(self):
        """Full flow: verify device, insert hb, update device, fetch + ack commands."""
        db = _FakeDB()
        # 1. devices.select (verify exists)
        db.add("devices", _chainable_mock(data=[{"id": "dev-1"}]))
        # 2. heartbeats.insert
        db.add("heartbeats", _chainable_mock())
        # 3. devices.update (status + last_heartbeat_at)
        db.add("devices", _chainable_mock())
        # 4. device_commands.select (pending)
        pending_cmds = [
            {"id": "cmd-1", "command_type": "restart", "payload": {}},
            {"id": "cmd-2", "command_type": "deploy_model", "payload": {"model_version": "v1"}},
        ]
        db.add("device_commands", _chainable_mock(data=pending_cmds))
        # 5+6. device_commands.update (ack each) — same mock can handle both
        ack_mock = _chainable_mock()
        db.add("device_commands", ack_mock)
        db.add("device_commands", ack_mock)

        svc = HeartbeatService(db)
        req = HeartbeatRequest(device_id="dev-1")

        result = svc.process_heartbeat("dev-1", req)

        assert len(result) == 2
        assert result[0]["command_type"] == "restart"
        assert result[1]["command_type"] == "deploy_model"

    def test_process_heartbeat_device_not_found(self):
        db = _FakeDB()
        db.add("devices", _chainable_mock(data=[]))

        svc = HeartbeatService(db)
        req = HeartbeatRequest(device_id="dev-missing")

        with pytest.raises(KeyError, match="not found"):
            svc.process_heartbeat("dev-missing", req)

    def test_process_heartbeat_no_pending(self):
        db = _FakeDB()
        db.add("devices", _chainable_mock(data=[{"id": "dev-1"}]))
        db.add("heartbeats", _chainable_mock())
        db.add("devices", _chainable_mock())
        db.add("device_commands", _chainable_mock(data=[]))

        svc = HeartbeatService(db)
        req = HeartbeatRequest(device_id="dev-1")

        result = svc.process_heartbeat("dev-1", req)
        assert result == []

    def test_process_heartbeat_updates_metadata(self):
        db = _FakeDB()
        db.add("devices", _chainable_mock(data=[{"id": "dev-1"}]))
        db.add("heartbeats", _chainable_mock())

        device_update_mock = _chainable_mock()
        db.add("devices", device_update_mock)
        db.add("device_commands", _chainable_mock(data=[]))

        svc = HeartbeatService(db)
        req = HeartbeatRequest(
            device_id="dev-1",
            firmware_version="fw-2.0",
            model_version="model-3.1",
            ip_address="192.168.1.10",
        )

        svc.process_heartbeat("dev-1", req)

        # Verify the update call included metadata fields
        update_call = device_update_mock.update.call_args[0][0]
        assert update_call["firmware_version"] == "fw-2.0"
        assert update_call["current_model_version"] == "model-3.1"
        assert update_call["ip_address"] == "192.168.1.10"
        assert update_call["status"] == DeviceStatus.ONLINE.value

    def test_detect_offline_devices(self):
        db = _FakeDB()
        stale_devices = [
            {"id": "dev-stale-1", "last_heartbeat_at": "2025-01-01T00:00:00Z"},
            {"id": "dev-stale-2", "last_heartbeat_at": "2025-01-01T00:00:00Z"},
        ]
        db.add("devices", _chainable_mock(data=stale_devices))
        # Two update calls to mark offline
        update_mock = _chainable_mock()
        db.add("devices", update_mock)
        db.add("devices", update_mock)

        svc = HeartbeatService(db)
        result = svc.detect_offline_devices("user-1")

        assert result == ["dev-stale-1", "dev-stale-2"]

    def test_detect_offline_devices_none(self):
        db = _FakeDB()
        db.add("devices", _chainable_mock(data=[]))

        svc = HeartbeatService(db)
        result = svc.detect_offline_devices("user-1")
        assert result == []


# ── CommandService ─────────────────────────────────────────────────


class TestCommandService:
    def test_enqueue_command(self):
        inserted_row = {
            "id": "cmd-new",
            "device_id": "dev-1",
            "user_id": "user-1",
            "command_type": "restart",
            "payload": {},
            "status": "pending",
        }
        db = _FakeDB()
        db.add("device_commands", _chainable_mock(data=[inserted_row]))

        svc = CommandService(db)
        result = svc.enqueue("user-1", "dev-1", "restart")

        assert result["id"] == "cmd-new"
        assert result["command_type"] == "restart"

    def test_enqueue_command_failure(self):
        db = _FakeDB()
        db.add("device_commands", _chainable_mock(data=[]))

        svc = CommandService(db)
        with pytest.raises(RuntimeError, match="Failed to insert"):
            svc.enqueue("user-1", "dev-1", "restart")

    def test_list_commands_no_filters(self):
        rows = [
            {"id": "cmd-1", "command_type": "restart", "status": "pending"},
            {"id": "cmd-2", "command_type": "deploy_model", "status": "completed"},
        ]
        mock = _chainable_mock(data=rows)
        db = _FakeDB()
        db.add("device_commands", mock)

        svc = CommandService(db)
        result = svc.list_commands("user-1")

        assert len(result) == 2
        # Verify user_id filter was applied
        mock.eq.assert_any_call("user_id", "user-1")

    def test_list_commands_filter_device(self):
        mock = _chainable_mock(data=[])
        db = _FakeDB()
        db.add("device_commands", mock)

        svc = CommandService(db)
        svc.list_commands("user-1", device_id="dev-42")

        mock.eq.assert_any_call("device_id", "dev-42")

    def test_list_commands_filter_status(self):
        mock = _chainable_mock(data=[])
        db = _FakeDB()
        db.add("device_commands", mock)

        svc = CommandService(db)
        svc.list_commands("user-1", status_filter="failed")

        mock.eq.assert_any_call("status", "failed")

    def test_complete_command(self):
        completed_row = {
            "id": "cmd-1",
            "status": "completed",
            "result": {"status": "done"},
        }
        db = _FakeDB()
        # check query
        db.add("device_commands", _chainable_mock(data=[{"id": "cmd-1"}]))
        # update query
        db.add("device_commands", _chainable_mock(data=[completed_row]))

        svc = CommandService(db)
        result = svc.complete_command("user-1", "cmd-1", {"status": "done"})

        assert result["status"] == "completed"

    def test_complete_command_not_found(self):
        db = _FakeDB()
        db.add("device_commands", _chainable_mock(data=[]))

        svc = CommandService(db)
        with pytest.raises(KeyError, match="not found"):
            svc.complete_command("user-1", "cmd-missing")

    def test_device_complete_command(self):
        completed_row = {
            "id": "cmd-1",
            "status": "completed",
            "result": {"status": "restarting"},
        }
        db = _FakeDB()
        db.add("device_commands", _chainable_mock(data=[{"id": "cmd-1"}]))
        db.add("device_commands", _chainable_mock(data=[completed_row]))

        svc = CommandService(db)
        result = svc.device_complete_command("dev-1", "cmd-1", {"status": "restarting"})

        assert result["status"] == "completed"

    def test_device_complete_command_wrong_device(self):
        db = _FakeDB()
        db.add("device_commands", _chainable_mock(data=[]))

        svc = CommandService(db)
        with pytest.raises(KeyError, match="not found"):
            svc.device_complete_command("wrong-dev", "cmd-1")

    def test_fail_command(self):
        failed_row = {
            "id": "cmd-1",
            "status": "failed",
            "result": {"error": "timeout"},
        }
        db = _FakeDB()
        db.add("device_commands", _chainable_mock(data=[failed_row]))

        svc = CommandService(db)
        result = svc.fail_command("cmd-1", "timeout")

        assert result["status"] == "failed"
        assert result["result"]["error"] == "timeout"
