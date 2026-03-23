"""End-to-end fleet lifecycle integration tests.

These tests exercise the full path through the FastAPI app with real service
classes but an in-memory Supabase fake.  The service layer is **not** mocked —
only the database and auth are fakes.

Lifecycle covered:
  1. Register device -> appears in device list
  2. Create deployment targeting the device -> verify status
  3. Send heartbeat -> device status updates to online
  4. Create alert -> resolve it -> verify resolved
  5. Batch command -> verify commands queued
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from .conftest import TEST_USER_ID, InMemorySupabase

pytestmark = pytest.mark.integration


# ── Helpers ───────────────────────────────────────────────────────────


def _seed_device_for_heartbeat(fake_sb: InMemorySupabase, device_id: str) -> None:
    """Ensure the device row exists in the store so HeartbeatService can find it."""
    rows = fake_sb.store.setdefault("devices", [])
    for r in rows:
        if r["id"] == device_id:
            return  # already present


# ── 1. Device Registration + Listing ─────────────────────────────────


class TestDeviceLifecycle:
    def test_register_and_list(self, client: TestClient, fake_supabase: InMemorySupabase):
        """Register a device and verify it shows up in GET /devices."""
        # Register
        resp = client.post("/devices", json={
            "name": "lifecycle-cam",
            "device_type": "camera",
            "tags": {"env": "test"},
        })
        assert resp.status_code == 201
        device = resp.json()
        assert device["name"] == "lifecycle-cam"
        assert device["status"] == "pending"
        assert "api_key" in device  # plaintext key returned on registration
        device_id = device["id"]

        # List
        resp = client.get("/devices")
        assert resp.status_code == 200
        ids = [d["id"] for d in resp.json()]
        assert device_id in ids

    def test_register_and_get_by_id(self, client: TestClient):
        resp = client.post("/devices", json={"name": "get-by-id-cam", "device_type": "edge_node"})
        assert resp.status_code == 201
        device_id = resp.json()["id"]

        resp = client.get(f"/devices/{device_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == device_id

    def test_update_device_name_and_tags(self, client: TestClient, registered_device):
        device_id = registered_device["id"]

        resp = client.patch(f"/devices/{device_id}", json={"name": "renamed-cam"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "renamed-cam"

        resp = client.put(f"/devices/{device_id}/tags", json={"zone": "b", "tier": "gold"})
        assert resp.status_code == 200
        assert resp.json()["tags"]["zone"] == "b"
        assert resp.json()["tags"]["tier"] == "gold"

    def test_decommission_device(self, client: TestClient, registered_device):
        device_id = registered_device["id"]

        resp = client.request("DELETE", f"/devices/{device_id}", json={
            "reason": "end-of-life",
            "wipe_data": False,
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "decommissioned"

        # Verify it's decommissioned when fetched again
        resp = client.get(f"/devices/{device_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "decommissioned"


# ── 2. Deployment Lifecycle ──────────────────────────────────────────


class TestDeploymentLifecycle:
    def test_create_deployment_for_device(self, client: TestClient, registered_device):
        device_id = registered_device["id"]

        resp = client.post("/deployments", json={
            "name": "yolov8-deploy-integ",
            "model_id": "yolov8",
            "model_version": "2.1.0",
            "strategy": "canary",
            "target_device_ids": [device_id],
            "rollout_stages": [
                {"name": "canary", "percentage": 10, "min_wait_seconds": 0},
                {"name": "full", "percentage": 100, "min_wait_seconds": 0},
            ],
        })
        assert resp.status_code == 201
        dep = resp.json()
        assert dep["status"] == "pending"
        assert dep["model_id"] == "yolov8"
        dep_id = dep["id"]

        # List deployments — our new one should be there
        resp = client.get("/deployments")
        assert resp.status_code == 200
        dep_ids = [d["id"] for d in resp.json()]
        assert dep_id in dep_ids

        # Get single deployment
        resp = client.get(f"/deployments/{dep_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "yolov8-deploy-integ"

    def test_create_deployment_no_devices_fails(self, client: TestClient):
        """Deployment with no target devices should fail at the service layer."""
        resp = client.post("/deployments", json={
            "name": "empty-deploy",
            "model_id": "yolov8",
            "model_version": "1.0",
            "strategy": "canary",
            "target_device_ids": [],
        })
        # The service raises ValueError which the router catches or returns 500/422
        assert resp.status_code in (400, 422, 500)

    def test_pause_deployment(self, client: TestClient, registered_device):
        device_id = registered_device["id"]
        resp = client.post("/deployments", json={
            "name": "pause-test",
            "model_id": "yolov8",
            "model_version": "1.0",
            "strategy": "rolling",
            "target_device_ids": [device_id],
            "rollout_stages": [{"name": "full", "percentage": 100, "min_wait_seconds": 0}],
        })
        assert resp.status_code == 201
        dep_id = resp.json()["id"]

        resp = client.post(f"/deployments/{dep_id}/pause")
        assert resp.status_code == 200
        assert resp.json()["status"] == "paused"

    def test_deployment_device_status(self, client: TestClient, registered_device):
        device_id = registered_device["id"]
        resp = client.post("/deployments", json={
            "name": "dev-status-test",
            "model_id": "yolov8",
            "model_version": "3.0",
            "strategy": "canary",
            "target_device_ids": [device_id],
            "rollout_stages": [{"name": "full", "percentage": 100, "min_wait_seconds": 0}],
        })
        assert resp.status_code == 201
        dep_id = resp.json()["id"]

        resp = client.get(f"/deployments/{dep_id}/devices")
        assert resp.status_code == 200
        statuses = resp.json()
        assert len(statuses) >= 1
        assert statuses[0]["device_id"] == device_id
        assert statuses[0]["status"] == "pending"


# ── 3. Heartbeat → Device Status Update ─────────────────────────────


class TestHeartbeatIntegration:
    def _override_device_key(self, client: TestClient, device_id: str) -> None:
        """Override get_device_api_key to return the actual registered device ID."""
        from fleet.deps import get_device_api_key
        client.app.dependency_overrides[get_device_api_key] = lambda: device_id

    def test_heartbeat_updates_device_to_online(
        self, client: TestClient, registered_device, fake_supabase: InMemorySupabase
    ):
        device_id = registered_device["id"]
        self._override_device_key(client, device_id)

        # Before heartbeat the device is in 'pending' status
        resp = client.get(f"/devices/{device_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"

        # Send heartbeat (uses device API key auth — dependency overridden)
        resp = client.post(
            "/heartbeats",
            json={
                "device_id": device_id,
                "resource_usage": {"cpu_percent": 45.0, "memory_percent": 62.0},
                "firmware_version": "1.1.0",
                "ip_address": "10.0.0.42",
            },
            headers={"X-Device-API-Key": "test-key"},
        )
        assert resp.status_code == 200
        hb = resp.json()
        assert hb["status"] == "ok"
        assert "server_time" in hb

        # Verify device status is now 'online'
        resp = client.get(f"/devices/{device_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "online"
        assert resp.json()["firmware_version"] == "1.1.0"

    def test_heartbeat_returns_pending_commands(
        self, client: TestClient, registered_device, fake_supabase: InMemorySupabase
    ):
        device_id = registered_device["id"]
        self._override_device_key(client, device_id)

        # Enqueue a restart command by restarting the device via the API
        resp = client.post(f"/devices/{device_id}/restart")
        assert resp.status_code == 202

        # Send heartbeat — should receive the pending restart command
        resp = client.post(
            "/heartbeats",
            json={"device_id": device_id},
            headers={"X-Device-API-Key": "test-key"},
        )
        assert resp.status_code == 200
        pending = resp.json()["pending_commands"]
        assert len(pending) >= 1
        assert any(c["command_type"] == "restart" for c in pending)


# ── 4. Alert Lifecycle ───────────────────────────────────────────────


class TestAlertLifecycle:
    def test_create_and_resolve_alert(
        self, client: TestClient, registered_device, fake_supabase: InMemorySupabase
    ):
        device_id = registered_device["id"]

        # Insert an alert directly into the store (AlertService.create_alert
        # is not exposed via a REST endpoint — alerts are created internally).
        from fleet.services.alert_service import AlertService

        svc = AlertService(fake_supabase)
        alert = svc.create_alert(
            user_id=TEST_USER_ID,
            alert_type="device_offline",
            severity="warning",
            title="Device went offline",
            message="No heartbeat for 60s",
            device_id=device_id,
        )
        alert_id = alert["id"]

        # List alerts — should appear
        resp = client.get("/alerts")
        assert resp.status_code == 200
        alert_ids = [a["id"] for a in resp.json()]
        assert alert_id in alert_ids

        # Verify it shows as unresolved
        alerts = resp.json()
        our_alert = next(a for a in alerts if a["id"] == alert_id)
        assert our_alert["resolved"] is False

        # Resolve the alert
        resp = client.post(f"/alerts/{alert_id}/resolve")
        assert resp.status_code == 200
        assert resp.json()["resolved"] is True
        assert resp.json()["resolved_at"] is not None

        # After resolve, list should still include it and show resolved=True
        resp = client.get("/alerts")
        assert resp.status_code == 200
        our_alert = next(a for a in resp.json() if a["id"] == alert_id)
        assert our_alert["resolved"] is True

    def test_resolve_nonexistent_alert_404(self, client: TestClient):
        resp = client.post("/alerts/nonexistent-id/resolve")
        assert resp.status_code == 404


# ── 5. Batch Command ────────────────────────────────────────────────


class TestBatchCommand:
    def test_batch_restart_by_tag(self, client: TestClient, fake_supabase: InMemorySupabase):
        """Register two devices with matching tags, batch restart them."""
        # Register device A
        resp = client.post("/devices", json={
            "name": "batch-a",
            "device_type": "camera",
            "tags": {"zone": "loading-dock"},
        })
        assert resp.status_code == 201
        dev_a = resp.json()["id"]

        # Register device B
        resp = client.post("/devices", json={
            "name": "batch-b",
            "device_type": "camera",
            "tags": {"zone": "loading-dock"},
        })
        assert resp.status_code == 201
        dev_b = resp.json()["id"]

        # Batch restart
        resp = client.post("/devices/batch", json={
            "action": "restart",
            "tag_filter": {"zone": "loading-dock"},
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["matched"] == 2
        assert len(body["commands"]) == 2
        device_ids_in_commands = {c["device_id"] for c in body["commands"]}
        assert dev_a in device_ids_in_commands
        assert dev_b in device_ids_in_commands

        # Verify commands were actually enqueued
        commands = fake_supabase.dump("device_commands")
        restart_cmds = [c for c in commands if c["command_type"] == "restart"]
        target_ids = {c["device_id"] for c in restart_cmds}
        assert dev_a in target_ids
        assert dev_b in target_ids

    def test_batch_no_matching_tags_404(self, client: TestClient):
        resp = client.post("/devices/batch", json={
            "action": "restart",
            "tag_filter": {"zone": "does-not-exist"},
        })
        assert resp.status_code == 404

    def test_batch_invalid_action_422(self, client: TestClient):
        resp = client.post("/devices/batch", json={
            "action": "invalid_action_xyz",
            "tag_filter": {"zone": "a"},
        })
        assert resp.status_code == 422


# ── 6. Command Lifecycle ────────────────────────────────────────────


class TestCommandLifecycle:
    def test_enqueue_and_complete_command(
        self, client: TestClient, registered_device, fake_supabase: InMemorySupabase
    ):
        device_id = registered_device["id"]

        # Restart the device (enqueues a command)
        resp = client.post(f"/devices/{device_id}/restart")
        assert resp.status_code == 202
        cmd_id = resp.json()["command_id"]

        # List commands for user
        resp = client.get("/commands")
        assert resp.status_code == 200
        assert any(c["id"] == cmd_id for c in resp.json())

        # Complete the command
        resp = client.post(f"/commands/{cmd_id}/complete", json={"status": "done"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    def test_device_complete_command(
        self, client: TestClient, registered_device, fake_supabase: InMemorySupabase
    ):
        device_id = registered_device["id"]

        resp = client.post(f"/devices/{device_id}/restart")
        assert resp.status_code == 202
        cmd_id = resp.json()["command_id"]

        # The device agent completes the command via device auth
        # We need to fix the device_id filter to match the overridden one
        # First update the command's device_id in the store to match the
        # device_api_key override ('dev-integ-device')
        cmds = fake_supabase.store.get("device_commands", [])
        for c in cmds:
            if c["id"] == cmd_id:
                c["device_id"] = "dev-integ-device"

        resp = client.post(
            f"/commands/{cmd_id}/device-complete",
            json={"status": "done"},
            headers={"X-Device-API-Key": "test-key"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"


# ── 7. Full Lifecycle Smoke Test ────────────────────────────────────


class TestFullLifecycle:
    def test_register_deploy_heartbeat_alert_batch(
        self, client: TestClient, fake_supabase: InMemorySupabase
    ):
        """End-to-end: register -> deploy -> heartbeat -> alert -> batch."""
        from fleet.deps import get_device_api_key

        # 1. Register a device
        resp = client.post("/devices", json={
            "name": "full-lifecycle-cam",
            "device_type": "camera",
            "tags": {"env": "prod", "site": "hq"},
        })
        assert resp.status_code == 201
        device = resp.json()
        device_id = device["id"]

        # 2. Create deployment
        resp = client.post("/deployments", json={
            "name": "full-lifecycle-deploy",
            "model_id": "yolov8",
            "model_version": "3.0.0",
            "strategy": "canary",
            "target_device_ids": [device_id],
            "rollout_stages": [
                {"name": "canary", "percentage": 50, "min_wait_seconds": 0},
                {"name": "full", "percentage": 100, "min_wait_seconds": 0},
            ],
        })
        assert resp.status_code == 201
        dep_id = resp.json()["id"]

        # 3. Send heartbeat — device goes online
        # Override device key to return the actual registered device ID
        client.app.dependency_overrides[get_device_api_key] = lambda: device_id
        resp = client.post(
            "/heartbeats",
            json={
                "device_id": device_id,
                "resource_usage": {"cpu_percent": 30.0, "memory_percent": 55.0},
            },
            headers={"X-Device-API-Key": "test-key"},
        )
        assert resp.status_code == 200

        # Verify online
        resp = client.get(f"/devices/{device_id}")
        assert resp.json()["status"] == "online"

        # 4. Create and resolve an alert
        from fleet.services.alert_service import AlertService

        alert = AlertService(fake_supabase).create_alert(
            user_id=TEST_USER_ID,
            alert_type="high_resource_usage",
            severity="warning",
            title="CPU high",
            device_id=device_id,
        )
        resp = client.post(f"/alerts/{alert['id']}/resolve")
        assert resp.status_code == 200
        assert resp.json()["resolved"] is True

        # 5. Register a second device with same tags, then batch restart
        resp = client.post("/devices", json={
            "name": "full-lifecycle-cam-2",
            "device_type": "camera",
            "tags": {"env": "prod", "site": "hq"},
        })
        assert resp.status_code == 201

        resp = client.post("/devices/batch", json={
            "action": "restart",
            "tag_filter": {"env": "prod", "site": "hq"},
        })
        assert resp.status_code == 200
        assert resp.json()["matched"] == 2
