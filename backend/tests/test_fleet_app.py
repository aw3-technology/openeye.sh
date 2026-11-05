"""App-level behaviour of the fleet control plane: rate limiting, CORS, and the
offline-device background sweeper."""

from __future__ import annotations

import asyncio
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from fleet import offline_sweeper
from fleet.app import create_fleet_app
from fleet.services.heartbeat_service import HeartbeatService

# ── Rate limiting ────────────────────────────────────────────────────


def test_rate_limit_returns_429_after_limit():
    client = TestClient(create_fleet_app(rate_limit=3))
    statuses = [client.get("/nope").status_code for _ in range(3)]
    assert 429 not in statuses
    resp = client.get("/nope")
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "60"
    assert "Rate limit" in resp.json()["detail"]


def test_rate_limit_default_is_120_per_window():
    client = TestClient(create_fleet_app())
    for _ in range(120):
        assert client.get("/nope").status_code != 429
    assert client.get("/nope").status_code == 429


def test_rate_limit_exempts_health():
    client = TestClient(create_fleet_app(rate_limit=1))
    for _ in range(5):
        assert client.get("/health").status_code == 200


def test_rate_limit_window_expires():
    client = TestClient(create_fleet_app(rate_limit=1, rate_window=0.2))
    assert client.get("/nope").status_code != 429
    assert client.get("/nope").status_code == 429
    time.sleep(0.25)
    assert client.get("/nope").status_code != 429


def test_rate_limit_state_is_per_app():
    a = TestClient(create_fleet_app(rate_limit=1))
    b = TestClient(create_fleet_app(rate_limit=1))
    assert a.get("/nope").status_code != 429
    assert b.get("/nope").status_code != 429


def test_rate_limited_response_has_cors_headers():
    client = TestClient(create_fleet_app(rate_limit=1))
    origin = {"Origin": "http://localhost:8080"}
    client.get("/nope", headers=origin)
    resp = client.get("/nope", headers=origin)
    assert resp.status_code == 429
    assert resp.headers["access-control-allow-origin"] == "http://localhost:8080"


# ── CORS ─────────────────────────────────────────────────────────────


def _preflight(client: TestClient, origin: str):
    return client.options(
        "/devices",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
        "https://openeye.sh",
        "https://www.openeye.sh",
    ],
)
def test_cors_default_origins(monkeypatch, origin):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    resp = _preflight(TestClient(create_fleet_app()), origin)
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == origin


def test_cors_env_overrides_defaults(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://example.test")
    client = TestClient(create_fleet_app())
    assert (
        _preflight(client, "https://example.test").headers[
            "access-control-allow-origin"
        ]
        == "https://example.test"
    )
    assert (
        "access-control-allow-origin"
        not in _preflight(client, "http://localhost:8080").headers
    )


# ── Offline sweeper ──────────────────────────────────────────────────


def test_sweep_interval_from_env(monkeypatch):
    monkeypatch.delenv(offline_sweeper.SWEEP_INTERVAL_ENV, raising=False)
    assert offline_sweeper.sweep_interval_from_env() == 30.0
    monkeypatch.setenv(offline_sweeper.SWEEP_INTERVAL_ENV, "5")
    assert offline_sweeper.sweep_interval_from_env() == 5.0
    monkeypatch.setenv(offline_sweeper.SWEEP_INTERVAL_ENV, "junk")
    assert offline_sweeper.sweep_interval_from_env() == 30.0


def test_lifespan_runs_sweeper_and_cancels_on_shutdown(monkeypatch):
    calls: list[float] = []

    def fake_sweep_once(db_factory):
        calls.append(time.monotonic())
        return ["dev-1"]

    monkeypatch.setattr(offline_sweeper, "sweep_once", fake_sweep_once)
    app = create_fleet_app(offline_sweep_interval=0.01)

    with TestClient(app):
        deadline = time.monotonic() + 2
        while len(calls) < 3 and time.monotonic() < deadline:
            time.sleep(0.01)
        task = app.state.offline_sweeper
        assert task is not None and not task.done()

    assert len(calls) >= 3
    assert task.cancelled()


def test_lifespan_sweeper_disabled():
    app = create_fleet_app(offline_sweep_interval=0)
    with TestClient(app):
        assert app.state.offline_sweeper is None


def test_lifespan_sweeper_disabled_by_env(monkeypatch):
    monkeypatch.setenv(offline_sweeper.SWEEP_INTERVAL_ENV, "0")
    app = create_fleet_app()
    with TestClient(app):
        assert app.state.offline_sweeper is None


def test_sweeper_stops_without_database_url():
    def no_db():
        raise RuntimeError("DATABASE_URL must be set (Neon Postgres connection string)")

    # Returns instead of looping forever
    asyncio.run(asyncio.wait_for(offline_sweeper.run_offline_sweeper(0.01, no_db), 1))


def test_sweeper_survives_a_failing_pass(monkeypatch):
    calls = {"n": 0}

    def flaky(db_factory):
        calls["n"] += 1
        if calls["n"] == 1:
            raise ValueError("transient")
        return []

    monkeypatch.setattr(offline_sweeper, "sweep_once", flaky)

    async def run():
        task = asyncio.create_task(offline_sweeper.run_offline_sweeper(0.01, object))
        while calls["n"] < 3:
            await asyncio.sleep(0.01)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(asyncio.wait_for(run(), 2))
    assert calls["n"] >= 3


class _RecordingQuery:
    def __init__(self, log: list, data):
        self._log = log
        self._data = data

    def __getattr__(self, name):
        def method(*args):
            self._log.append((name, args))
            return self

        return method

    def execute(self):
        return SimpleNamespace(data=self._data)


class _RecordingDB:
    def __init__(self, stale):
        self.queries: list[list] = []
        self._stale = stale

    def table(self, name):
        log: list = [("table", (name,))]
        self.queries.append(log)
        return _RecordingQuery(log, self._stale if len(self.queries) == 1 else [])


def test_sweep_once_marks_stale_devices_across_all_users():
    db = _RecordingDB(stale=[{"id": "dev-a"}, {"id": "dev-b"}])
    ids = offline_sweeper.sweep_once(lambda: db)

    assert ids == ["dev-a", "dev-b"]
    select = db.queries[0]
    # No user_id filter when sweeping globally
    assert not any(op == "eq" and args[0] == "user_id" for op, args in select)
    assert ("eq", ("status", "online")) in select
    updates = db.queries[1:]
    assert len(updates) == 2
    for q in updates:
        assert ("update", ({"status": "offline"},)) in q
        # guarded so a fresh heartbeat isn't overwritten
        assert any(op == "lt" and args[0] == "last_heartbeat_at" for op, args in q)


def test_detect_offline_devices_still_scopes_by_user():
    db = _RecordingDB(stale=[])
    HeartbeatService(db).detect_offline_devices("user-1")
    assert ("eq", ("user_id", "user-1")) in db.queries[0]
