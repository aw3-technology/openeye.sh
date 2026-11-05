"""Postgres data layer for the fleet control plane (Neon).

Replaces supabase-py. ``Database.table(name)`` returns a small query builder
with the same fluent interface the services already used against PostgREST::

    db.table("devices").select("id, status").eq("user_id", uid) \\
        .order("created_at", desc=True).range(0, 49).execute()

``execute()`` returns a :class:`QueryResult` with ``.data`` (list of dicts with
JSON-friendly values: uuid -> str, datetime -> ISO-8601, Decimal -> float) and
``.count`` (total matching rows when ``select(..., count="exact")`` was used).
``insert`` / ``update`` / ``delete`` return the affected rows (``RETURNING *``),
like PostgREST with ``Prefer: return=representation``.

All SQL is built with :mod:`psycopg.sql` — identifiers are quoted with
``sql.Identifier`` and values are always bound parameters, never interpolated.

The builder only *compiles* SQL; running it is delegated to an executor with a
``run(query, params) -> list[dict]`` method (:class:`Database` in production).
Tests can swap in a fake executor and inspect the compiled statements.

There is no row-level security: every call site must scope its query to the
authenticated user (``user_id``) or device (``device_id``).
"""

from __future__ import annotations

import logging
import os
import threading
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Iterable, Optional, Protocol, Sequence

from psycopg import sql
from psycopg.types.json import Jsonb

logger = logging.getLogger(__name__)

# Columns that are native Postgres arrays (text[]) in db/schema.sql. Python
# lists written to any *other* column are sent as jsonb, which matches the
# schema (target_device_ids, device_ids, rollout_stages, ... are all jsonb).
ARRAY_COLUMNS: dict[str, frozenset[str]] = {
    "api_keys": frozenset({"scopes"}),
    "observation_memory": frozenset({"tags"}),
}

_COMPARATORS = {
    "eq": "=",
    "neq": "<>",
    "gt": ">",
    "gte": ">=",
    "lt": "<",
    "lte": "<=",
}


class Executor(Protocol):
    def run(
        self, query: sql.Composable, params: Sequence[Any]
    ) -> list[dict[str, Any]]: ...


@dataclass
class QueryResult:
    """Mimics postgrest's ``APIResponse`` (``.data`` and ``.count``)."""

    data: list[dict[str, Any]]
    count: Optional[int] = None


# ── Value conversion ──────────────────────────────────────────


def to_json_value(value: Any) -> Any:
    """Convert a value read from Postgres into what PostgREST would have sent."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, list):
        return [to_json_value(v) for v in value]
    if isinstance(value, dict):
        return {k: to_json_value(v) for k, v in value.items()}
    return value


def to_json_row(row: dict[str, Any]) -> dict[str, Any]:
    return {k: to_json_value(v) for k, v in row.items()}


def adapt_value(table: str, column: str, value: Any) -> Any:
    """Adapt a Python value for writing into ``table.column``."""
    if isinstance(value, dict):
        return Jsonb(value)
    if isinstance(value, (list, tuple)):
        if column in ARRAY_COLUMNS.get(table, frozenset()):
            return list(value)
        return Jsonb(list(value))
    return value


def _parse_columns(columns: str) -> sql.Composable:
    cols = [c.strip() for c in columns.split(",") if c.strip()]
    if not cols or cols == ["*"]:
        return sql.SQL("*")
    for c in cols:
        if "(" in c or ":" in c or "!" in c:
            raise ValueError(f"Unsupported select expression {c!r} (no embeds)")
    return sql.SQL(", ").join(sql.Identifier(c) for c in cols)


# ── Query builder ─────────────────────────────────────────────


class QueryBuilder:
    """Fluent, PostgREST-style query builder compiled to parameterised SQL."""

    def __init__(self, executor: Optional[Executor], table: str) -> None:
        self._executor = executor
        self._table = table
        self._op = "select"
        self._columns = "*"
        self._count: Optional[str] = None
        self._filters: list[tuple[str, str, Any]] = []
        self._order: list[tuple[str, bool]] = []
        self._limit: Optional[int] = None
        self._offset: Optional[int] = None
        self._payload: Any = None

    # ── Operations ──

    def select(self, columns: str = "*", count: Optional[str] = None) -> QueryBuilder:
        self._op = "select"
        self._columns = columns
        self._count = count
        return self

    def insert(self, rows: dict[str, Any] | list[dict[str, Any]]) -> QueryBuilder:
        self._op = "insert"
        self._payload = [rows] if isinstance(rows, dict) else list(rows)
        return self

    def update(self, values: dict[str, Any]) -> QueryBuilder:
        self._op = "update"
        self._payload = dict(values)
        return self

    def delete(self) -> QueryBuilder:
        self._op = "delete"
        return self

    # ── Filters ──

    def _filter(self, op: str, column: str, value: Any) -> QueryBuilder:
        self._filters.append((op, column, value))
        return self

    def eq(self, column: str, value: Any) -> QueryBuilder:
        return self._filter("eq", column, value)

    def neq(self, column: str, value: Any) -> QueryBuilder:
        return self._filter("neq", column, value)

    def gt(self, column: str, value: Any) -> QueryBuilder:
        return self._filter("gt", column, value)

    def gte(self, column: str, value: Any) -> QueryBuilder:
        return self._filter("gte", column, value)

    def lt(self, column: str, value: Any) -> QueryBuilder:
        return self._filter("lt", column, value)

    def lte(self, column: str, value: Any) -> QueryBuilder:
        return self._filter("lte", column, value)

    def in_(self, column: str, values: Iterable[Any]) -> QueryBuilder:
        return self._filter("in", column, list(values))

    def is_(self, column: str, value: Any) -> QueryBuilder:
        return self._filter("is", column, value)

    # ── Modifiers ──

    def order(self, column: str, desc: bool = False) -> QueryBuilder:
        self._order.append((column, desc))
        return self

    def limit(self, n: int) -> QueryBuilder:
        self._limit = int(n)
        return self

    def range(self, start: int, end: int) -> QueryBuilder:
        """Inclusive row range, like PostgREST's ``Range: start-end``."""
        self._offset = int(start)
        self._limit = max(0, int(end) - int(start) + 1)
        return self

    # ── Compilation ──

    def _where(self) -> tuple[sql.Composable, list[Any]]:
        if not self._filters:
            return sql.SQL(""), []
        parts: list[sql.Composable] = []
        params: list[Any] = []
        for op, column, value in self._filters:
            ident = sql.Identifier(column)
            if op == "in":
                if not value:
                    parts.append(sql.SQL("false"))
                    continue
                placeholders = sql.SQL(", ").join(sql.Placeholder() * len(value))
                parts.append(sql.SQL("{} in ({})").format(ident, placeholders))
                params.extend(value)
            elif op == "is" or (op in ("eq", "neq") and value is None):
                if value is None:
                    neg = op == "neq"
                    parts.append(
                        sql.SQL("{} is not null" if neg else "{} is null").format(ident)
                    )
                elif value is True or value is False:
                    lit = sql.SQL("true" if value else "false")
                    parts.append(sql.SQL("{} is {}").format(ident, lit))
                else:
                    raise ValueError(
                        f"is_() only supports None/True/False, got {value!r}"
                    )
            else:
                parts.append(
                    sql.SQL("{} {} {}").format(
                        ident, sql.SQL(_COMPARATORS[op]), sql.Placeholder()
                    )
                )
                params.append(value)
        return sql.SQL(" where ") + sql.SQL(" and ").join(parts), params

    def _order_limit(self) -> tuple[sql.Composable, list[Any]]:
        out: list[sql.Composable] = []
        params: list[Any] = []
        if self._order:
            out.append(
                sql.SQL(" order by ")
                + sql.SQL(", ").join(
                    sql.SQL("{} {}").format(
                        sql.Identifier(c), sql.SQL("desc" if d else "asc")
                    )
                    for c, d in self._order
                )
            )
        if self._limit is not None:
            out.append(sql.SQL(" limit %s"))
            params.append(self._limit)
        if self._offset:
            out.append(sql.SQL(" offset %s"))
            params.append(self._offset)
        return sql.Composed(out), params

    def compile(self) -> list[tuple[str, sql.Composable, list[Any]]]:
        """Return ``[(kind, query, params), ...]`` — kind is "rows" or "count"."""
        table = sql.Identifier(self._table)
        where, wparams = self._where()

        if self._op == "select":
            tail, tparams = self._order_limit()
            q = (
                sql.SQL("select {} from {}").format(
                    _parse_columns(self._columns), table
                )
                + where
                + tail
            )
            stmts = [("rows", q, wparams + tparams)]
            if self._count:
                cq = sql.SQL("select count(*) as count from {}").format(table) + where
                stmts.append(("count", cq, list(wparams)))
            return stmts

        if self._op == "insert":
            rows: list[dict[str, Any]] = self._payload
            if not rows:
                raise ValueError("insert() requires at least one row")
            columns: list[str] = []
            for r in rows:
                for k in r:
                    if k not in columns:
                        columns.append(k)
            params: list[Any] = []
            values_sql: list[sql.Composable] = []
            for r in rows:
                cells: list[sql.Composable] = []
                for c in columns:
                    if c in r:
                        cells.append(sql.Placeholder())
                        params.append(adapt_value(self._table, c, r[c]))
                    else:
                        cells.append(sql.DEFAULT)
                values_sql.append(sql.SQL("({})").format(sql.SQL(", ").join(cells)))
            q = sql.SQL("insert into {} ({}) values {} returning *").format(
                table,
                sql.SQL(", ").join(sql.Identifier(c) for c in columns),
                sql.SQL(", ").join(values_sql),
            )
            return [("rows", q, params)]

        if self._op == "update":
            if not self._filters:
                raise ValueError("update() without filters is not allowed")
            values: dict[str, Any] = self._payload
            if not values:
                raise ValueError("update() requires at least one column")
            sets = sql.SQL(", ").join(
                sql.SQL("{} = {}").format(sql.Identifier(c), sql.Placeholder())
                for c in values
            )
            params = [adapt_value(self._table, c, v) for c, v in values.items()]
            q = sql.SQL("update {} set {}").format(table, sets) + where
            q += sql.SQL(" returning *")
            return [("rows", q, params + wparams)]

        if self._op == "delete":
            if not self._filters:
                raise ValueError("delete() without filters is not allowed")
            q = (
                sql.SQL("delete from {}").format(table)
                + where
                + sql.SQL(" returning *")
            )
            return [("rows", q, wparams)]

        raise ValueError(f"Unknown operation {self._op!r}")

    def execute(self) -> QueryResult:
        if self._executor is None:
            raise RuntimeError("QueryBuilder has no executor")
        data: list[dict[str, Any]] = []
        count: Optional[int] = None
        for kind, query, params in self.compile():
            rows = self._executor.run(query, params)
            if kind == "count":
                count = int(rows[0]["count"]) if rows else 0
            else:
                data = [to_json_row(r) for r in rows]
        return QueryResult(data=data, count=count)


# ── Database (psycopg pool) ───────────────────────────────────


class Database:
    """Thread-safe Postgres client backed by a psycopg connection pool."""

    def __init__(self, dsn: str, min_size: int = 1, max_size: int = 10) -> None:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        self._pool = ConnectionPool(
            dsn,
            min_size=min_size,
            max_size=max_size,
            open=True,
            # prepare_threshold=None keeps us compatible with Neon's pgbouncer
            # (transaction-mode) pooled endpoints.
            kwargs={
                "autocommit": True,
                "row_factory": dict_row,
                "prepare_threshold": None,
            },
        )

    def table(self, name: str) -> QueryBuilder:
        return QueryBuilder(self, name)

    def run(
        self, query: sql.Composable | str, params: Sequence[Any] = ()
    ) -> list[dict[str, Any]]:
        with self._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, list(params))
                if cur.description is None:
                    return []
                return list(cur.fetchall())

    def query(
        self, query: sql.Composable | str, params: Sequence[Any] = ()
    ) -> list[dict[str, Any]]:
        """Run raw parameterised SQL and return JSON-friendly rows."""
        return [to_json_row(r) for r in self.run(query, params)]

    def close(self) -> None:
        self._pool.close()


_db: Optional[Database] = None
_db_lock = threading.Lock()


def get_database() -> Database:
    """Return the process-wide :class:`Database` (lazily created from DATABASE_URL)."""
    global _db
    if _db is None:
        with _db_lock:
            if _db is None:
                dsn = os.environ.get("DATABASE_URL", "")
                if not dsn:
                    raise RuntimeError(
                        "DATABASE_URL must be set (Neon Postgres connection string)"
                    )
                max_size = int(os.environ.get("DATABASE_POOL_MAX", "10"))
                _db = Database(dsn, max_size=max_size)
    return _db


def close_database() -> None:
    global _db
    with _db_lock:
        if _db is not None:
            _db.close()
            _db = None
