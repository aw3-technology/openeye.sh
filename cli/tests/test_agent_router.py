"""Tests for agent router endpoints (User Story 87)."""

from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from openeye_ai.server import agent_router


@pytest.fixture(autouse=True)
def _reset_agent_state():
    """Reset module-level agent state before each test."""
    agent_router._agent_state.update({
        "running": False,
        "tick_count": 0,
        "current_plan": [],
        "goal": "",
        "events": [],
        "task": None,
    })
    agent_router._memory_store.clear()


# ── POST /agent/start ─────────────────────────────────────────────────


def test_start_agent(app_client):
    r = app_client.post("/agent/start", json={"goal": "monitor safety"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "started"
    assert data["goal"] == "monitor safety"


def test_start_agent_already_running(app_client):
    app_client.post("/agent/start", json={"goal": "test"})
    r = app_client.post("/agent/start", json={"goal": "test again"})
    assert r.status_code == 409
    assert "already running" in r.json()["error"]


# ── POST /agent/stop ──────────────────────────────────────────────────


def test_stop_agent(app_client):
    app_client.post("/agent/start", json={"goal": "test"})
    r = app_client.post("/agent/stop")
    assert r.status_code == 200
    assert r.json()["status"] == "stopped"


# ── GET /agent/status ─────────────────────────────────────────────────


def test_agent_status_not_running(app_client):
    r = app_client.get("/agent/status")
    assert r.status_code == 200
    data = r.json()
    assert data["running"] is False
    assert data["tick_count"] == 0


def test_agent_status_running(app_client):
    app_client.post("/agent/start", json={"goal": "watch scene"})
    r = app_client.get("/agent/status")
    data = r.json()
    assert data["running"] is True
    assert data["goal"] == "watch scene"


# ── GET /agent/memory ─────────────────────────────────────────────────


def test_memory_empty(app_client):
    r = app_client.get("/agent/memory", params={"limit": 5})
    assert r.status_code == 200
    assert r.json() == []


def test_memory_with_observations(app_client):
    from openeye_ai.schema import BBox, DetectedObject, Observation

    obs = Observation(
        tick=1,
        detections=[DetectedObject(label="person", confidence=0.9, bbox=BBox(x=0.1, y=0.2, w=0.3, h=0.4))],
        scene_summary="1 object — person",
        significance=0.5,
        tags=["person"],
    )
    agent_router._memory_store.store(obs)

    r = app_client.get("/agent/memory", params={"limit": 10})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["tick"] == 1


# ── POST /agent/recall ───────────────────────────────────────────────


def test_recall_empty(app_client):
    r = app_client.post("/agent/recall", json={"query": "person", "limit": 5})
    assert r.status_code == 200
    data = r.json()
    assert data["total_matches"] == 0


# ── GET /agent/stream content type ──────────────────────────────────


def test_stream_content_type(app_client):
    """SSE endpoint should return text/event-stream."""
    agent_router._agent_state["running"] = False  # ensure generator exits fast
    r = app_client.get("/agent/stream")
    assert r.headers["content-type"].startswith("text/event-stream")
