"""Integration test fixtures — in-memory Supabase fake with real service logic.

The ``InMemorySupabase`` replaces the real Supabase SDK client with a dict-based
store so that services can call ``.table(...).insert(...).execute()`` chains and
see consistent data across the request lifecycle without a running database.
"""

from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from fleet.app import create_fleet_app
from fleet.auth_middleware import AuthContext, require_auth, require_jwt_auth
from fleet.deps import ApiKeyContext, get_api_key_auth, get_current_user_id, get_device_api_key, get_supabase

# ── Constants ─────────────────────────────────────────────────────────

TEST_USER_ID = "user-integ-1"
TEST_DEVICE_API_KEY = "oek_test-device-key-for-integration"


# ── In-memory Supabase fake ──────────────────────────────────────────


class _QueryResult:
    """Mimics ``postgrest.types.APIResponse``."""

    def __init__(self, data: List[Dict[str, Any]], count: Optional[int] = None):
        self.data = data
        self.count = count if count is not None else len(data)


class _QueryBuilder:
    """Chainable query builder backed by a shared ``dict[str, list]`` store."""

    def __init__(self, store: Dict[str, List[Dict[str, Any]]], table: str):
        self._store = store
        self._table = table
        self._filters: List[tuple[str, str, Any]] = []
        self._insert_payload: Optional[Dict[str, Any]] = None
        self._update_payload: Optional[Dict[str, Any]] = None
        self._delete = False
        self._select_fields: str = "*"
        self._count_mode: Optional[str] = None
        self._order_field: Optional[str] = None
        self._order_desc: bool = False
        self._limit_val: Optional[int] = None
        self._range_start: Optional[int] = None
        self._range_end: Optional[int] = None

    # ── Chainable methods ──

    def select(self, fields: str = "*", count: Optional[str] = None) -> "_QueryBuilder":
        self._select_fields = fields
        self._count_mode = count
        return self

    def insert(self, payload: Dict[str, Any]) -> "_QueryBuilder":
        self._insert_payload = payload
        return self

    def update(self, payload: Dict[str, Any]) -> "_QueryBuilder":
        self._update_payload = payload
        return self

    def delete(self) -> "_QueryBuilder":
        self._delete = True
        return self

    def eq(self, col: str, val: Any) -> "_QueryBuilder":
        self._filters.append(("eq", col, val))
        return self

    def neq(self, col: str, val: Any) -> "_QueryBuilder":
        self._filters.append(("neq", col, val))
        return self

    def gt(self, col: str, val: Any) -> "_QueryBuilder":
        self._filters.append(("gt", col, val))
        return self

    def gte(self, col: str, val: Any) -> "_QueryBuilder":
        self._filters.append(("gte", col, val))
        return self

    def lt(self, col: str, val: Any) -> "_QueryBuilder":
        self._filters.append(("lt", col, val))
        return self

    def lte(self, col: str, val: Any) -> "_QueryBuilder":
        self._filters.append(("lte", col, val))
        return self

    def in_(self, col: str, values: List[Any]) -> "_QueryBuilder":
        self._filters.append(("in", col, values))
        return self

    def is_(self, col: str, val: Any) -> "_QueryBuilder":
        self._filters.append(("is", col, val))
        return self

    def like(self, col: str, val: str) -> "_QueryBuilder":
        self._filters.append(("like", col, val))
        return self

    def ilike(self, col: str, val: str) -> "_QueryBuilder":
        self._filters.append(("ilike", col, val))
        return self

    def order(self, field: str, desc: bool = False) -> "_QueryBuilder":
        self._order_field = field
        self._order_desc = desc
        return self

    def limit(self, n: int) -> "_QueryBuilder":
        self._limit_val = n
        return self

    def range(self, start: int, end: int) -> "_QueryBuilder":
        self._range_start = start
        self._range_end = end
        return self

    def single(self) -> "_QueryBuilder":
        """Like .limit(1) but returns a single row instead of a list."""
        self._limit_val = 1
        return self

    # ── Execution ──

    def _match(self, row: Dict[str, Any]) -> bool:
        for op, col, val in self._filters:
            rv = row.get(col)
            if op == "eq" and rv != val:
                return False
            if op == "neq" and rv == val:
                return False
            if op == "gt" and not (rv is not None and rv > val):
                return False
            if op == "gte" and not (rv is not None and rv >= val):
                return False
            if op == "lt" and not (rv is not None and rv < val):
                return False
            if op == "lte" and not (rv is not None and rv <= val):
                return False
            if op == "in" and rv not in val:
                return False
            if op == "is" and rv is not val:
                return False
        return True

    def execute(self) -> _QueryResult:
        rows = self._store.setdefault(self._table, [])

        # INSERT
        if self._insert_payload is not None:
            new_row = dict(self._insert_payload)
            now = datetime.now(timezone.utc).isoformat()
            new_row.setdefault("id", str(uuid.uuid4()))
            new_row.setdefault("created_at", now)
            new_row.setdefault("updated_at", now)
            rows.append(new_row)
            return _QueryResult([copy.deepcopy(new_row)])

        # UPDATE
        if self._update_payload is not None:
            matched = [r for r in rows if self._match(r)]
            now = datetime.now(timezone.utc).isoformat()
            for r in matched:
                r.update(self._update_payload)
                r["updated_at"] = now
            return _QueryResult([copy.deepcopy(r) for r in matched])

        # DELETE
        if self._delete:
            before = len(rows)
            to_remove = [r for r in rows if self._match(r)]
            for r in to_remove:
                rows.remove(r)
            return _QueryResult(to_remove)

        # SELECT
        matched = [r for r in rows if self._match(r)]
        if self._order_field:
            matched.sort(
                key=lambda r: r.get(self._order_field, ""),
                reverse=self._order_desc,
            )
        total = len(matched)
        if self._range_start is not None and self._range_end is not None:
            matched = matched[self._range_start : self._range_end + 1]
        if self._limit_val is not None:
            matched = matched[: self._limit_val]

        return _QueryResult(
            [copy.deepcopy(r) for r in matched],
            count=total if self._count_mode else len(matched),
        )


class InMemorySupabase:
    """Drop-in replacement for ``supabase.Client`` backed by plain dicts."""

    def __init__(self) -> None:
        self.store: Dict[str, List[Dict[str, Any]]] = {}
        # Stub out auth so get_current_user_id won't be called via this path
        self.auth = MagicMock()

    def table(self, name: str) -> _QueryBuilder:
        return _QueryBuilder(self.store, name)

    def dump(self, table: str) -> List[Dict[str, Any]]:
        """Helper: return a snapshot of all rows in a table."""
        return copy.deepcopy(self.store.get(table, []))


# ── Fixtures ──────────────────────────────────────────────────────────


@pytest.fixture()
def fake_supabase() -> InMemorySupabase:
    """A fresh in-memory Supabase store per test."""
    return InMemorySupabase()


_TEST_AUTH_CONTEXT = AuthContext(
    user_id=TEST_USER_ID,
    auth_method="jwt",
    scopes=["*"],
)


@pytest.fixture()
def fleet_app(fake_supabase: InMemorySupabase):
    """Fleet FastAPI app with auth + Supabase dependencies overridden."""
    app = create_fleet_app()

    app.dependency_overrides[get_supabase] = lambda: fake_supabase
    app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    app.dependency_overrides[get_device_api_key] = lambda: "dev-integ-device"
    app.dependency_overrides[require_auth] = lambda: _TEST_AUTH_CONTEXT
    app.dependency_overrides[require_jwt_auth] = lambda: _TEST_AUTH_CONTEXT

    yield app
    app.dependency_overrides.clear()


@pytest.fixture()
def client(fleet_app) -> TestClient:
    """Authenticated TestClient (JWT-style — user_id dependency overridden)."""
    return TestClient(fleet_app, raise_server_exceptions=False)


@pytest.fixture()
def api_key_client(fleet_app, fake_supabase: InMemorySupabase) -> TestClient:
    """TestClient authenticated via API key (for /v1 inference endpoints)."""
    import hashlib

    raw_key = "oe_test_integration_key_1234567890"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    # Seed an API key row so the dependency can find it
    fake_supabase.store.setdefault("api_keys", []).append({
        "id": "ak-integ-1",
        "user_id": TEST_USER_ID,
        "key_hash": key_hash,
        "key_prefix": "oe_test_",
        "scopes": ["inference"],
        "rate_limit": 100,
        "last_used_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # For API key tests we want the *real* get_api_key_auth dependency to run
    # but with our fake Supabase, so just override Supabase.
    fleet_app.dependency_overrides[get_api_key_auth] = lambda: ApiKeyContext(
        user_id=TEST_USER_ID,
        api_key_id="ak-integ-1",
        key_prefix="oe_test_",
        scopes=["inference"],
        rate_limit=100,
    )

    tc = TestClient(fleet_app, raise_server_exceptions=False)
    tc.headers.update({"X-API-Key": raw_key})
    return tc


@pytest.fixture()
def registered_device(client, fake_supabase: InMemorySupabase) -> Dict[str, Any]:
    """Register a device and return the response body (includes api_key)."""
    resp = client.post("/devices", json={
        "name": "integ-cam-1",
        "device_type": "camera",
        "tags": {"zone": "warehouse-a", "env": "staging"},
        "firmware_version": "1.0.0",
        "ip_address": "10.0.0.42",
    })
    assert resp.status_code == 201, f"Device registration failed: {resp.text}"
    return resp.json()
