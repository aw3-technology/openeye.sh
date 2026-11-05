"""Unit tests for the Postgres query-builder shim (fleet.db).

No database needed: statements are compiled and rendered with
``Composable.as_string(None)``, and execution goes through a recording fake
executor.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import pytest
from psycopg.types.json import Jsonb

from fleet.db import QueryBuilder, adapt_value, to_json_row


class _RecordingExecutor:
    def __init__(self, results: list[list[dict[str, Any]]] | None = None) -> None:
        self.calls: list[tuple[str, list[Any]]] = []
        self._results = list(results or [])

    def run(self, query, params):
        self.calls.append((query.as_string(None), list(params)))
        return self._results.pop(0) if self._results else []

    def table(self, name: str) -> QueryBuilder:
        return QueryBuilder(self, name)


def _sql(builder: QueryBuilder) -> list[tuple[str, str, list[Any]]]:
    return [(kind, q.as_string(None), p) for kind, q, p in builder.compile()]


# ── SELECT ────────────────────────────────────────────────────


class TestSelect:
    def test_select_star_with_filters_is_parameterised(self):
        stmts = _sql(QueryBuilder(None, "devices").select("*").eq("user_id", "u1"))
        assert stmts == [
            ("rows", 'select * from "devices" where "user_id" = %s', ["u1"])
        ]

    def test_select_columns_are_quoted_identifiers(self):
        ((kind, sql, params),) = _sql(
            QueryBuilder(None, "devices").select("id, status").eq("api_key_hash", "h")
        )
        assert sql == 'select "id", "status" from "devices" where "api_key_hash" = %s'
        assert params == ["h"]

    def test_values_are_never_interpolated(self):
        evil = "x'; drop table devices; --"
        ((_, sql, params),) = _sql(
            QueryBuilder(None, "devices").select().eq("name", evil)
        )
        assert evil not in sql
        assert params == [evil]

    def test_hostile_identifier_is_quoted(self):
        ((_, sql, _),) = _sql(QueryBuilder(None, "devices").select().eq('a"b', 1))
        assert '"a""b" = %s' in sql

    def test_comparators(self):
        q = (
            QueryBuilder(None, "api_usage_log")
            .select("id")
            .gte("created_at", "2026-01-01")
            .lt("created_at", "2026-02-01")
            .gt("credits_used", 0)
            .lte("credits_used", 9)
            .neq("endpoint", "/v1/x")
        )
        ((_, sql, params),) = _sql(q)
        assert sql == (
            'select "id" from "api_usage_log" where "created_at" >= %s and '
            '"created_at" < %s and "credits_used" > %s and "credits_used" <= %s '
            'and "endpoint" <> %s'
        )
        assert params == ["2026-01-01", "2026-02-01", 0, 9, "/v1/x"]

    def test_in_expands_one_placeholder_per_value(self):
        ((_, sql, params),) = _sql(
            QueryBuilder(None, "devices")
            .select("id")
            .eq("user_id", "u")
            .in_("id", ["a", "b", "c"])
        )
        assert sql.endswith('where "user_id" = %s and "id" in (%s, %s, %s)')
        assert params == ["u", "a", "b", "c"]

    def test_empty_in_matches_nothing(self):
        ((_, sql, params),) = _sql(QueryBuilder(None, "devices").select().in_("id", []))
        assert sql == 'select * from "devices" where false'
        assert params == []

    def test_eq_none_and_is(self):
        ((_, sql, params),) = _sql(
            QueryBuilder(None, "fleet_alerts")
            .select()
            .eq("device_id", None)
            .neq("resolved_at", None)
            .is_("resolved", False)
        )
        assert sql.endswith(
            'where "device_id" is null and "resolved_at" is not null and "resolved" is false'
        )
        assert params == []

    def test_order_limit(self):
        ((_, sql, params),) = _sql(
            QueryBuilder(None, "heartbeats")
            .select("resource_usage, created_at")
            .eq("device_id", "d")
            .order("created_at", desc=True)
            .limit(100)
        )
        assert sql.endswith('order by "created_at" desc limit %s')
        assert params == ["d", 100]

    def test_order_default_ascending_and_multiple(self):
        ((_, sql, _),) = _sql(
            QueryBuilder(None, "device_commands")
            .select()
            .order("issued_at")
            .order("id", desc=True)
        )
        assert sql.endswith('order by "issued_at" asc, "id" desc')

    def test_range_is_inclusive(self):
        ((_, sql, params),) = _sql(QueryBuilder(None, "devices").select().range(20, 29))
        assert sql.endswith("limit %s offset %s")
        assert params == [10, 20]

    def test_range_from_zero_has_no_offset(self):
        ((_, sql, params),) = _sql(QueryBuilder(None, "devices").select().range(0, 49))
        assert sql.endswith("limit %s")
        assert params == [50]

    def test_count_exact_adds_count_query_without_paging(self):
        stmts = _sql(
            QueryBuilder(None, "group_members")
            .select("id", count="exact")
            .eq("group_id", "g")
            .range(0, 9)
        )
        assert stmts[1] == (
            "count",
            'select count(*) as count from "group_members" where "group_id" = %s',
            ["g"],
        )

    def test_embeds_are_rejected(self):
        with pytest.raises(ValueError):
            QueryBuilder(None, "devices").select("*, groups(*)").compile()


# ── Writes ────────────────────────────────────────────────────


class TestWrites:
    def test_insert_returns_rows_and_wraps_jsonb(self):
        ((_, sql, params),) = _sql(
            QueryBuilder(None, "devices").insert(
                {"user_id": "u", "name": "cam", "tags": {"zone": "a"}}
            )
        )
        assert sql == (
            'insert into "devices" ("user_id", "name", "tags") values (%s, %s, %s) returning *'
        )
        assert params[:2] == ["u", "cam"]
        assert isinstance(params[2], Jsonb) and params[2].obj == {"zone": "a"}

    def test_insert_many_fills_missing_columns_with_default(self):
        ((_, sql, params),) = _sql(
            QueryBuilder(None, "device_commands").insert(
                [
                    {"device_id": "d1", "command_type": "restart"},
                    {"device_id": "d2", "payload": {"a": 1}},
                ]
            )
        )
        assert sql == (
            'insert into "device_commands" ("device_id", "command_type", "payload") '
            "values (%s, %s, DEFAULT), (%s, DEFAULT, %s) returning *"
        )
        assert params[0:3] == ["d1", "restart", "d2"]
        assert isinstance(params[3], Jsonb)

    def test_lists_are_jsonb_except_native_array_columns(self):
        jsonb_list = adapt_value("deployments", "target_device_ids", ["a", "b"])
        assert isinstance(jsonb_list, Jsonb) and jsonb_list.obj == ["a", "b"]
        assert adapt_value("api_keys", "scopes", ("inference",)) == ["inference"]
        assert adapt_value("devices", "name", "x") == "x"

    def test_update_sets_then_filters_returning(self):
        ((_, sql, params),) = _sql(
            QueryBuilder(None, "devices")
            .update({"status": "online", "config_overrides": {"fps": 5}})
            .eq("id", "d")
            .eq("user_id", "u")
        )
        assert sql == (
            'update "devices" set "status" = %s, "config_overrides" = %s '
            'where "id" = %s and "user_id" = %s returning *'
        )
        assert params[0] == "online"
        assert isinstance(params[1], Jsonb)
        assert params[2:] == ["d", "u"]

    def test_delete_returning(self):
        ((_, sql, params),) = _sql(
            QueryBuilder(None, "group_members")
            .delete()
            .eq("group_id", "g")
            .eq("device_id", "d")
        )
        assert sql == (
            'delete from "group_members" where "group_id" = %s and "device_id" = %s returning *'
        )
        assert params == ["g", "d"]

    @pytest.mark.parametrize("op", ["update", "delete"])
    def test_unfiltered_update_and_delete_are_refused(self, op):
        b = QueryBuilder(None, "devices")
        b = b.update({"status": "x"}) if op == "update" else b.delete()
        with pytest.raises(ValueError):
            b.compile()


# ── Execution / result shape ──────────────────────────────────


class TestExecute:
    def test_rows_are_json_friendly(self):
        uid = uuid.uuid4()
        ts = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
        ex = _RecordingExecutor(
            [
                [
                    {
                        "id": uid,
                        "created_at": ts,
                        "progress": Decimal("12.5"),
                        "stage": Decimal("3"),
                        "tags": {"nested": [uid]},
                        "name": "x",
                        "n": None,
                    }
                ]
            ]
        )
        res = ex.table("deployment_device_status").select().eq("id", str(uid)).execute()
        assert res.data == [
            {
                "id": str(uid),
                "created_at": "2026-01-02T03:04:05+00:00",
                "progress": 12.5,
                "stage": 3,
                "tags": {"nested": [str(uid)]},
                "name": "x",
                "n": None,
            }
        ]
        assert res.count is None

    def test_count_populated_from_second_statement(self):
        ex = _RecordingExecutor([[{"id": "a"}], [{"count": 42}]])
        res = (
            ex.table("api_usage_log")
            .select("id", count="exact")
            .eq("api_key_id", "k")
            .execute()
        )
        assert res.data == [{"id": "a"}]
        assert res.count == 42
        assert len(ex.calls) == 2

    def test_insert_returns_affected_rows(self):
        ex = _RecordingExecutor([[{"id": "new", "name": "cam"}]])
        res = ex.table("devices").insert({"name": "cam", "user_id": "u"}).execute()
        assert res.data == [{"id": "new", "name": "cam"}]
        assert "returning *" in ex.calls[0][0]

    def test_to_json_row_passthrough(self):
        assert to_json_row({"a": 1, "b": True, "c": [1, 2]}) == {
            "a": 1,
            "b": True,
            "c": [1, 2],
        }
