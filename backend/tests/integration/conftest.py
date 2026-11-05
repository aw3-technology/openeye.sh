"""Integration test fixtures — in-memory database fake with real service logic.

The ``InMemoryDB`` replaces the Postgres client (fleet.db.Database) with a dict-based
store so that services can call ``.table(...).insert(...).execute()`` chains and
see consistent data across the request lifecycle without a running database.
"""

from __future__ import annotations

import copy
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import pytest
from fastapi.testclient import TestClient

from fleet.app import create_fleet_app
from fleet.auth_middleware import AuthContext, require_auth, require_jwt_auth
from fleet.deps import (
    ApiKeyContext,
    get_api_key_auth,
    get_current_user_id,
    get_device_api_key,
    get_db,
)

# ── Constants ─────────────────────────────────────────────────────────

TEST_USER_ID = "user-integ-1"
TEST_DEVICE_API_KEY = "oek_test-device-key-for-integration"


# ── Schema (db/schema.sql is the source of truth) ─────────────────────

_SCHEMA_PATH = Path(__file__).resolve().parents[3] / "db" / "schema.sql"
_NON_COLUMN_PREFIXES = ("unique", "primary", "constraint", "check", "foreign")


def _parse_schema(text: str) -> Dict[str, Dict[str, bool]]:
    """Return ``{table: {column: required_on_insert}}`` from schema.sql.

    A column is "required" when it is ``not null`` with no default and is not
    a primary key — inserting a row without it would fail in Postgres.
    """
    tables: Dict[str, Dict[str, bool]] = {}
    for m in re.finditer(
        r'create table if not exists\s+"?(\w+)"?\s*\((.*?)\n\);', text, re.S
    ):
        cols: Dict[str, bool] = {}
        for line in m.group(2).splitlines():
            line = line.strip().rstrip(",")
            if not line or line.lower().startswith(_NON_COLUMN_PREFIXES):
                continue
            name = line.split()[0].strip('"')
            lower = line.lower()
            cols[name] = (
                "not null" in lower
                and "default" not in lower
                and "primary key" not in lower
            )
        tables[m.group(1)] = cols
    return tables


SCHEMA = _parse_schema(_SCHEMA_PATH.read_text())


def _check_columns(table: str, columns: Iterable[str]) -> None:
    unknown = [c for c in columns if c not in SCHEMA[table]]
    if unknown:
        raise AssertionError(
            f"Unknown column(s) {unknown} on table {table!r} (db/schema.sql)"
        )


class _QueryResult:
    """Mimics ``fleet.db.QueryResult``."""

    def __init__(self, data: List[Dict[str, Any]], count: Optional[int] = None):
        self.data = data
        self.count = count if count is not None else len(data)


class _QueryBuilder:
    """Chainable query builder backed by a shared ``dict[str, list]`` store."""

    def __init__(self, store: Dict[str, List[Dict[str, Any]]], table: str):
        if table not in SCHEMA:
            raise AssertionError(f"Unknown table {table!r} (not in db/schema.sql)")
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

    def insert(self, payload: Dict[str, Any] | List[Dict[str, Any]]) -> "_QueryBuilder":
        self._insert_payload = [payload] if isinstance(payload, dict) else list(payload)
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

    def _validate(self) -> None:
        """Reject tables/columns that don't exist in db/schema.sql."""
        _check_columns(self._table, [c for _, c, _ in self._filters])
        if self._order_field:
            _check_columns(self._table, [self._order_field])
        if self._select_fields.strip() != "*":
            _check_columns(
                self._table,
                [c.strip() for c in self._select_fields.split(",") if c.strip()],
            )
        if self._update_payload is not None:
            _check_columns(self._table, self._update_payload)
        for row in self._insert_payload or []:
            _check_columns(self._table, row)
            missing = [
                c
                for c, required in SCHEMA[self._table].items()
                if required and c not in row
            ]
            if missing:
                raise AssertionError(
                    f"Insert into {self._table!r} is missing NOT NULL column(s) {missing}"
                )

    def execute(self) -> _QueryResult:
        self._validate()
        rows = self._store.setdefault(self._table, [])
        columns = SCHEMA[self._table]
        now = datetime.now(timezone.utc).isoformat()

        # INSERT
        if self._insert_payload is not None:
            inserted = []
            for payload in self._insert_payload:
                new_row = dict(payload)
                new_row.setdefault("id", str(uuid.uuid4()))
                for ts in ("created_at", "updated_at", "issued_at"):
                    if ts in columns:
                        new_row.setdefault(ts, now)
                rows.append(new_row)
                inserted.append(copy.deepcopy(new_row))
            return _QueryResult(inserted)

        # UPDATE
        if self._update_payload is not None:
            assert self._filters, "update() without filters"
            matched = [r for r in rows if self._match(r)]
            for r in matched:
                r.update(self._update_payload)
                if "updated_at" in columns:
                    r["updated_at"] = now
            return _QueryResult([copy.deepcopy(r) for r in matched])

        # DELETE
        if self._delete:
            assert self._filters, "delete() without filters"
            to_remove = [r for r in rows if self._match(r)]
            for r in to_remove:
                rows.remove(r)
            return _QueryResult(to_remove)

        # SELECT
        matched = [r for r in rows if self._match(r)]
        if self._order_field:
            matched.sort(
                key=lambda r: r.get(self._order_field) or "",
                reverse=self._order_desc,
            )
        total = len(matched)
        if self._range_start is not None and self._range_end is not None:
            matched = matched[self._range_start : self._range_end + 1]
        if self._limit_val is not None:
            matched = matched[: self._limit_val]

        return _QueryResult(
            [copy.deepcopy(r) for r in matched],
            count=total if self._count_mode else None,
        )


class InMemoryDB:
    """Drop-in replacement for ``fleet.db.Database`` backed by plain dicts.

    Implements the query-builder interface (``table(...)``) and a tiny subset of
    raw ``query()`` — the Better Auth session lookup and user-email lookup —
    against rows seeded into ``store["session"]`` / ``store["user"]``.
    """

    def __init__(self) -> None:
        self.store: Dict[str, List[Dict[str, Any]]] = {}

    def query(self, sql: Any, params: Any = ()) -> List[Dict[str, Any]]:
        text = str(sql)
        if 'from "session"' in text:
            tokens = set(params[0])
            now = datetime.now(timezone.utc).isoformat()
            return [
                {"user_id": s["userId"]}
                for s in self.store.get("session", [])
                if s["token"] in tokens and s["expiresAt"] > now
            ][:1]
        if 'from "user"' in text:
            return [
                {"email": u["email"]}
                for u in self.store.get("user", [])
                if u["id"] == params[0]
            ]
        raise NotImplementedError(f"InMemoryDB.query does not support: {text}")

    def table(self, name: str) -> _QueryBuilder:
        return _QueryBuilder(self.store, name)

    def dump(self, table: str) -> List[Dict[str, Any]]:
        """Helper: return a snapshot of all rows in a table."""
        return copy.deepcopy(self.store.get(table, []))


# ── Fixtures ──────────────────────────────────────────────────────────


@pytest.fixture()
def fake_db() -> InMemoryDB:
    """A fresh in-memory database per test."""
    return InMemoryDB()


_TEST_AUTH_CONTEXT = AuthContext(
    user_id=TEST_USER_ID,
    auth_method="jwt",
    scopes=["*"],
)


@pytest.fixture()
def fleet_app(fake_db: InMemoryDB):
    """Fleet FastAPI app with auth + database dependencies overridden."""
    app = create_fleet_app()

    app.dependency_overrides[get_db] = lambda: fake_db
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
def api_key_client(fleet_app, fake_db: InMemoryDB) -> TestClient:
    """TestClient authenticated via API key (for /v1 inference endpoints)."""
    import hashlib

    raw_key = "oe_test_integration_key_1234567890"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    # Seed an API key row so the dependency can find it
    fake_db.store.setdefault("api_keys", []).append(
        {
            "id": "ak-integ-1",
            "user_id": TEST_USER_ID,
            "key_hash": key_hash,
            "key_prefix": "oe_test_",
            "scopes": ["inference"],
            "rate_limit": 100,
            "last_used_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    # For API key tests we want the *real* get_api_key_auth dependency to run
    # but with our fake database.
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
def registered_device(client, fake_db: InMemoryDB) -> Dict[str, Any]:
    """Register a device and return the response body (includes api_key)."""
    resp = client.post(
        "/devices",
        json={
            "name": "integ-cam-1",
            "device_type": "camera",
            "tags": {"zone": "warehouse-a", "env": "staging"},
            "firmware_version": "1.0.0",
            "ip_address": "10.0.0.42",
        },
    )
    assert resp.status_code == 201, f"Device registration failed: {resp.text}"
    return resp.json()
