"""Better Auth session-token auth and API-key auth (no live database)."""

from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from fleet.app import create_fleet_app
from fleet.auth_middleware import require_auth, require_jwt_auth
from fleet.db import QueryBuilder
from fleet.deps import (
    get_current_user_id,
    get_db,
    resolve_session_user_id,
    session_token_candidates,
)


class _FakeDB:
    """Fake Database: raw ``query`` answers the session lookup like Postgres
    would; ``table`` compiles real SQL and serves rows from ``tables``."""

    def __init__(self) -> None:
        self.sessions: list[dict[str, Any]] = []
        self.tables: dict[str, list[dict[str, Any]]] = {}
        self.queries: list[tuple[str, list[Any]]] = []
        self.writes: list[str] = []

    def add_session(self, token: str, user_id: str, expires_in: float = 3600) -> None:
        self.sessions.append(
            {
                "token": token,
                "userId": user_id,
                "expiresAt": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
            }
        )

    def query(self, sql: str, params: list[Any]) -> list[dict[str, Any]]:
        self.queries.append((sql, params))
        assert 'from "session"' in sql and '"expiresAt" > now()' in sql
        tokens = params[0]
        now = datetime.now(timezone.utc)
        return [
            {"user_id": s["userId"]}
            for s in self.sessions
            if s["token"] in tokens and s["expiresAt"] > now
        ][:1]

    # Minimal executor for QueryBuilder: equality filters only.
    def table(self, name: str) -> QueryBuilder:
        return QueryBuilder(self, name)

    def run(self, query, params):
        text = query.as_string(None)
        if text.startswith("update"):
            self.writes.append(text)
            return []
        table = text.split(" from ")[1].split('"')[1]
        rows = self.tables.get(table, [])
        if "where" in text:
            cols = [
                part.split('"')[1] for part in text.split(" where ")[1].split(" and ")
            ]
            rows = [r for r in rows if all(r.get(c) == v for c, v in zip(cols, params))]
        return rows[:1] if " limit " in text else rows


# ── Token parsing ─────────────────────────────────────────────


class TestSessionTokenCandidates:
    def test_raw_token(self):
        assert session_token_candidates("abc123") == ["abc123"]

    def test_signed_cookie_value_tries_token_part(self):
        assert session_token_candidates("abc123.c2lnbmF0dXJl%3D") == [
            "abc123.c2lnbmF0dXJl=",
            "abc123",
        ]

    def test_empty(self):
        assert session_token_candidates("   ") == []


# ── resolve_session_user_id ───────────────────────────────────


class TestResolveSession:
    def test_valid_session(self):
        db = _FakeDB()
        db.add_session("tok", "user-1")
        assert resolve_session_user_id(db, "tok") == "user-1"
        sql, params = db.queries[0]
        assert '"token" = any(%s)' in sql
        assert params == [["tok"]]

    def test_signed_value_resolves(self):
        db = _FakeDB()
        db.add_session("tok", "user-1")
        assert resolve_session_user_id(db, "tok.sig") == "user-1"

    def test_expired_session_rejected(self):
        db = _FakeDB()
        db.add_session("tok", "user-1", expires_in=-5)
        assert resolve_session_user_id(db, "tok") is None

    def test_unknown_token(self):
        db = _FakeDB()
        db.add_session("tok", "user-1")
        assert resolve_session_user_id(db, "nope") is None


# ── Dependencies ──────────────────────────────────────────────


def _run(coro):
    return asyncio.run(coro)


class TestDependencies:
    def test_get_current_user_id(self):
        db = _FakeDB()
        db.add_session("tok", "user-9")
        assert _run(get_current_user_id(authorization="Bearer tok", db=db)) == "user-9"

    @pytest.mark.parametrize("header", ["tok", "Bearer bad", "Basic tok"])
    def test_get_current_user_id_rejects(self, header):
        db = _FakeDB()
        db.add_session("tok", "user-9")
        with pytest.raises(HTTPException) as exc:
            _run(get_current_user_id(authorization=header, db=db))
        assert exc.value.status_code == 401

    def test_db_error_is_401_not_500(self):
        class _Broken(_FakeDB):
            def query(self, sql, params):
                raise RuntimeError("connection refused")

        with pytest.raises(HTTPException) as exc:
            _run(get_current_user_id(authorization="Bearer tok", db=_Broken()))
        assert exc.value.status_code == 401

    def test_require_auth_session(self):
        db = _FakeDB()
        db.add_session("tok", "user-1")
        ctx = _run(require_auth(authorization="Bearer tok", x_api_key=None, db=db))
        assert ctx.user_id == "user-1" and ctx.auth_method == "jwt"

    def test_require_auth_api_key(self):
        db = _FakeDB()
        raw = "oe_live_abcdefghijklmnop"
        db.tables["api_keys"] = [
            {
                "id": "ak-1",
                "user_id": "user-2",
                "key_prefix": "oe_live_",
                "key_hash": hashlib.sha256(raw.encode()).hexdigest(),
                "scopes": ["inference"],
                "rate_limit": 30,
            }
        ]
        ctx = _run(require_auth(authorization=None, x_api_key=raw, db=db))
        assert (ctx.user_id, ctx.auth_method, ctx.api_key_id) == (
            "user-2",
            "api_key",
            "ak-1",
        )
        assert ctx.scopes == ["inference"]
        assert any('update "api_keys" set "last_used_at"' in w for w in db.writes)

    def test_require_auth_bad_api_key(self):
        db = _FakeDB()
        with pytest.raises(HTTPException) as exc:
            _run(
                require_auth(
                    authorization="Bearer oe_unknown_key_123", x_api_key=None, db=db
                )
            )
        assert exc.value.status_code == 401

    def test_require_jwt_auth_refuses_api_keys(self):
        db = _FakeDB()
        with pytest.raises(HTTPException):
            _run(require_jwt_auth(authorization="Bearer oe_whatever_123", db=db))


# ── Through the app ───────────────────────────────────────────


class TestAppIntegration:
    @pytest.fixture()
    def app_db(self):
        app = create_fleet_app()
        db = _FakeDB()
        db.add_session("good-token", "user-app")
        db.tables["devices"] = [
            {
                "id": "d1",
                "user_id": "user-app",
                "name": "cam",
                "device_type": "camera",
                "status": "online",
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }
        ]
        app.dependency_overrides[get_db] = lambda: db
        yield TestClient(app, raise_server_exceptions=False), db
        app.dependency_overrides.clear()

    def test_session_token_authorises_device_list(self, app_db):
        client, _ = app_db
        resp = client.get("/devices", headers={"Authorization": "Bearer good-token"})
        assert resp.status_code == 200, resp.text
        assert [d["id"] for d in resp.json()] == ["d1"]

    def test_signed_cookie_value_works_as_bearer(self, app_db):
        client, _ = app_db
        resp = client.get(
            "/devices", headers={"Authorization": "Bearer good-token.sig%2Bx"}
        )
        assert resp.status_code == 200

    def test_invalid_token_is_401(self, app_db):
        client, _ = app_db
        resp = client.get("/devices", headers={"Authorization": "Bearer nope"})
        assert resp.status_code == 401
