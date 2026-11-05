"""Opt-in smoke test against a real, disposable Postgres with db/schema.sql applied.

Skipped unless ``FLEET_TEST_DATABASE_URL`` is set. Never point it at a shared
or production database — the test creates and deletes its own user.

    initdb -D /tmp/pg && pg_ctl -D /tmp/pg -o "-p 55871" start
    createdb -p 55871 fleet && psql -p 55871 -d fleet -f ../db/schema.sql
    FLEET_TEST_DATABASE_URL=postgresql://localhost:55871/fleet pytest tests/integration/test_postgres_live.py
"""

from __future__ import annotations

import hashlib
import io
import os
import secrets
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from fleet.app import create_fleet_app
from fleet.db import Database
from fleet.deps import get_credits_service, get_db, get_inference_service

DSN = os.environ.get("FLEET_TEST_DATABASE_URL")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not DSN, reason="FLEET_TEST_DATABASE_URL not set (needs a disposable Postgres)"
    ),
]


@pytest.fixture()
def live():
    db = Database(DSN, max_size=2)
    user_id = f"live-{secrets.token_hex(6)}"
    token = secrets.token_urlsafe(24)
    db.run(
        'insert into "user" ("id", "name", "email", "emailVerified") values (%s, %s, %s, true)',
        [user_id, "Live Test", f"{user_id}@example.com"],
    )
    db.run(
        'insert into "session" ("id", "token", "userId", "expiresAt", "updatedAt") '
        "values (%s, %s, %s, now() + interval '1 hour', now())",
        [secrets.token_hex(8), token, user_id],
    )
    raw_key = f"oe_live_{secrets.token_hex(12)}"
    db.table("api_keys").insert(
        {
            "user_id": user_id,
            "name": "live",
            "key_prefix": raw_key[:8],
            "key_hash": hashlib.sha256(raw_key.encode()).hexdigest(),
            "scopes": ["inference"],
            "rate_limit": 100,
        }
    ).execute()

    app = create_fleet_app()
    app.dependency_overrides[get_db] = lambda: db
    credits = MagicMock()
    credits.check_and_deduct = AsyncMock(return_value=True)
    credits.refund = AsyncMock(return_value=True)
    credits.get_balance = AsyncMock(return_value=42)
    inference = MagicMock()
    inference.detect = AsyncMock(
        return_value={
            "model": "yolov8",
            "objects": [],
            "image": {"width": 8, "height": 8},
            "inference_ms": 1.0,
        }
    )
    app.dependency_overrides[get_credits_service] = lambda: credits
    app.dependency_overrides[get_inference_service] = lambda: inference
    client = TestClient(app)
    client.headers.update({"Authorization": f"Bearer {token}"})
    try:
        yield client, db, user_id, raw_key, token
    finally:
        db.run('delete from "user" where "id" = %s', [user_id])
        db.close()


def test_fleet_flow_against_postgres(live):
    client, db, user_id, raw_key, token = live

    # Signed cookie form (<token>.<signature>) also authenticates
    assert (
        client.get(
            "/devices", headers={"Authorization": f"Bearer {token}.sig"}
        ).status_code
        == 200
    )
    assert (
        client.get("/devices", headers={"Authorization": "Bearer nope"}).status_code
        == 401
    )
    # Malformed UUIDs are a 400, not a 500
    assert (
        TestClient(client.app, raise_server_exceptions=False)
        .get("/devices/not-a-uuid", headers=client.headers)
        .status_code
        == 400
    )

    # Register device → heartbeat → list
    resp = client.post(
        "/devices",
        json={
            "name": "live-cam",
            "device_type": "camera",
            "tags": {"zone": "a"},
            "firmware_version": "1.0.0",
        },
    )
    assert resp.status_code == 201, resp.text
    device = resp.json()
    device_id, device_key = device["id"], device["api_key"]
    assert device["tags"] == {"zone": "a"}

    resp = client.post(f"/devices/{device_id}/restart")
    assert resp.status_code == 202, resp.text

    resp = client.post(
        "/heartbeats",
        json={
            "device_id": device_id,
            "resource_usage": {"cpu_percent": 12.5},
            "firmware_version": "1.1.0",
        },
        headers={"X-Device-API-Key": device_key},
    )
    assert resp.status_code == 200, resp.text
    assert [c["command_type"] for c in resp.json()["pending_commands"]] == ["restart"]

    resp = client.get("/devices", params={"limit": 10})
    assert resp.status_code == 200
    (listed,) = [d for d in resp.json() if d["id"] == device_id]
    assert listed["status"] == "online" and listed["firmware_version"] == "1.1.0"

    resp = client.get(f"/devices/{device_id}/resources")
    assert (
        resp.status_code == 200
        and resp.json()[0]["resource_usage"]["cpu_percent"] == 12.5
    )

    # Groups (group_members) + deployments (jsonb lists, deployment_device_status)
    group = client.post(
        "/groups", json={"name": "live-group", "tag_filter": {"zone": "a"}}
    ).json()
    assert (
        client.post(
            f"/groups/{group['id']}/members", params={"device_id": device_id}
        ).status_code
        == 201
    )
    assert (
        client.post(
            f"/groups/{group['id']}/members", params={"device_id": device_id}
        ).status_code
        == 409
    )
    assert client.get(f"/groups/{group['id']}").json()["device_count"] == 1
    assert [d["id"] for d in client.get(f"/groups/{group['id']}/members").json()] == [
        device_id
    ]

    resp = client.post(
        "/deployments",
        json={
            "name": "live-dep",
            "model_id": "yolov8",
            "model_version": "2.0",
            "strategy": "canary",
            "target_group_id": group["id"],
            "rollout_stages": [
                {"name": "canary", "percentage": 50, "min_wait_seconds": 0},
                {"name": "full", "percentage": 100, "min_wait_seconds": 0},
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    dep = resp.json()
    resp = client.post(f"/deployments/{dep['id']}/advance")
    assert resp.status_code == 200, resp.text
    assert resp.json()["current_stage"] == 1
    statuses = client.get(f"/deployments/{dep['id']}/devices").json()
    assert (
        statuses[0]["device_id"] == device_id and statuses[0]["status"] == "in_progress"
    )

    # Commands, maintenance windows
    cmds = client.get("/commands", params={"device_id": device_id}).json()
    assert {c["command_type"] for c in cmds} >= {"restart", "deploy_model"}
    now = datetime.now(timezone.utc)
    resp = client.post(
        "/maintenance",
        json={
            "name": "mw",
            "device_ids": [device_id],
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(hours=1)).isoformat(),
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["device_ids"] == [device_id]

    # Hosted API: API-key auth, rate limit count, usage log
    buf = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buf, format="JPEG")
    resp = client.post(
        "/v1/detect",
        files={"file": ("x.jpg", buf.getvalue(), "image/jpeg")},
        headers={"X-API-Key": raw_key, "Authorization": ""},
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers["X-RateLimit-Remaining"] == "99"
    usage = client.get(
        "/v1/usage", headers={"X-API-Key": raw_key, "Authorization": ""}
    ).json()
    assert usage["balance"] == 42 and usage["total_requests"] == 1
    last_used = db.query(
        "select last_used_at from api_keys where user_id = %s", [user_id]
    )
    assert last_used[0]["last_used_at"] is not None

    # Decommissioned device key is refused
    assert (
        client.request(
            "DELETE", f"/devices/{device_id}", json={"reason": "eol"}
        ).status_code
        == 200
    )
    resp = client.post(
        "/heartbeats",
        json={"device_id": device_id},
        headers={"X-Device-API-Key": device_key},
    )
    assert resp.status_code == 403
