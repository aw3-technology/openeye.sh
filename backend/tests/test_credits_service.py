"""CreditsService against a mocked Cred credits API (httpx.MockTransport)."""

from __future__ import annotations

import asyncio
import json
import logging

import httpx
import pytest

from fleet.services import credits_service as cs
from fleet.services.credits_service import CreditsService

BASE = "https://cred.example/functions/v1"


def _service(handler, email="ada@example.com", api_key="cred-key"):
    seen: list[httpx.Request] = []

    def _wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    client = httpx.AsyncClient(transport=httpx.MockTransport(_wrapped))
    svc = CreditsService(
        email_lookup=(lambda uid: email) if email is not None else None,
        api_key=api_key,
        api_base=BASE,
        client=client,
    )
    return svc, seen


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for var in (
        "CRED_API_KEY",
        "CRED_API_BASE",
        "CRED_CREDIT_TYPE_ID",
        "CRED_APP_ORIGIN",
        "AW3_CRED_API_KEY",
        "AW3_CRED_CREDIT_TYPE_ID",
        "AW3_CRED_PRICING_TIER_ID",
    ):
        monkeypatch.delenv(var, raising=False)


class TestDeduct:
    def test_success_posts_identity_and_amount(self):
        svc, seen = _service(
            lambda r: httpx.Response(200, json={"success": True, "new_balance": 9})
        )
        assert _run(svc.check_and_deduct("user-1", 3)) is True
        req = seen[0]
        assert req.method == "POST"
        assert str(req.url) == f"{BASE}/credits-api/deduct"
        assert req.headers["x-api-key"] == "cred-key"
        assert req.headers["x-app-origin"] == "https://openeye.sh"
        body = json.loads(req.content)
        assert body["user_id"] == "user-1"
        assert body["email"] == body["user_email"] == "ada@example.com"
        assert body["amount"] == 3
        assert "credit_type_id" not in body

    @pytest.mark.parametrize("status", [400, 402, 404, 409, 422])
    def test_insufficient_credits_returns_false(self, status):
        svc, _ = _service(
            lambda r: httpx.Response(status, json={"error": "Insufficient credits"})
        )
        assert _run(svc.check_and_deduct("user-1", 3)) is False

    def test_server_error_raises(self):
        svc, _ = _service(lambda r: httpx.Response(500, json={"error": "boom"}))
        with pytest.raises(httpx.HTTPStatusError):
            _run(svc.check_and_deduct("user-1", 1))

    def test_credit_type_is_forwarded(self, monkeypatch):
        monkeypatch.setenv("CRED_CREDIT_TYPE_ID", "ct-eye")
        svc, seen = _service(lambda r: httpx.Response(200, json={"success": True}))
        _run(svc.check_and_deduct("user-1", 1))
        assert json.loads(seen[0].content)["credit_type_id"] == "ct-eye"

    def test_no_email_sends_user_id_only(self):
        svc, seen = _service(
            lambda r: httpx.Response(200, json={"success": True}), email=None
        )
        _run(svc.check_and_deduct("user-1", 1))
        body = json.loads(seen[0].content)
        assert body["user_id"] == "user-1" and "email" not in body


class TestRefund:
    def test_refund_uses_issue_endpoint(self):
        svc, seen = _service(lambda r: httpx.Response(200, json={"success": True}))
        assert _run(svc.refund("user-1", 2)) is True
        assert str(seen[0].url) == f"{BASE}/credits-api/issue"
        assert json.loads(seen[0].content)["amount"] == 2

    def test_refund_failure_is_swallowed(self):
        svc, _ = _service(lambda r: httpx.Response(503))
        assert _run(svc.refund("user-1", 2)) is False


class TestBalance:
    def test_balance_by_email_sums_balances(self):
        payload = {
            "balances": [
                {"credit_type_id": "a", "balance": 10},
                {"credit_type_id": "b", "balance": 5},
            ]
        }
        svc, seen = _service(lambda r: httpx.Response(200, json=payload))
        assert _run(svc.get_balance("user-1")) == 15
        assert seen[0].method == "GET"
        assert seen[0].url.path.endswith("/credits-api/balance")
        assert seen[0].url.params["email"] == "ada@example.com"

    def test_balance_filters_credit_type(self, monkeypatch):
        monkeypatch.setenv("CRED_CREDIT_TYPE_ID", "b")
        payload = {
            "balances": [
                {"credit_type_id": "a", "balance": 10},
                {"credit_type_id": "b", "balance": 5},
            ]
        }
        svc, _ = _service(lambda r: httpx.Response(200, json=payload))
        assert _run(svc.get_balance("user-1")) == 5

    def test_balance_by_user_id_without_email(self):
        svc, seen = _service(
            lambda r: httpx.Response(200, json={"balances": []}), email=None
        )
        assert _run(svc.get_balance("user-1")) == 0
        assert seen[0].url.params["user_id"] == "user-1"


class TestDisabled:
    def test_no_api_key_allows_everything_and_warns_once(self, monkeypatch, caplog):
        monkeypatch.setattr(cs, "_warned_disabled", False)

        def _fail(request):
            raise AssertionError("Cred must not be called when disabled")

        svc, seen = _service(_fail, api_key="")
        with caplog.at_level(logging.WARNING, logger=cs.__name__):
            assert _run(svc.check_and_deduct("user-1", 5)) is True
            assert _run(svc.check_and_deduct("user-1", 5)) is True
            assert _run(svc.refund("user-1", 5)) is True
            assert _run(svc.get_balance("user-1")) == 0
        assert seen == []
        warnings = [r for r in caplog.records if "CRED_API_KEY" in r.getMessage()]
        assert len(warnings) == 1

    def test_env_key_and_base_are_used(self, monkeypatch):
        monkeypatch.setenv("CRED_API_KEY", "env-key")
        monkeypatch.setenv("CRED_API_BASE", "https://other.example/fn/")
        seen: list[httpx.Request] = []

        def handler(r):
            seen.append(r)
            return httpx.Response(200, json={"success": True})

        svc = CreditsService(
            client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
        )
        assert _run(svc.check_and_deduct("u", 1)) is True
        assert str(seen[0].url) == "https://other.example/fn/credits-api/deduct"
        assert seen[0].headers["x-api-key"] == "env-key"

    def test_default_base_is_cred_service(self, monkeypatch):
        svc = CreditsService(api_key="k")
        assert svc._url("deduct") == f"{cs.DEFAULT_CRED_API_BASE}/credits-api/deduct"


# ── Shared AW3 Credit (legacy first, never split) ──

HUB_KEY = "hub-key"


def _aw3_on(monkeypatch):
    monkeypatch.setenv("AW3_CRED_API_KEY", HUB_KEY)
    monkeypatch.setenv("AW3_CRED_CREDIT_TYPE_ID", "ct-aw3")
    monkeypatch.setenv("AW3_CRED_PRICING_TIER_ID", "tier-aw3")


def _aw3_service(
    legacy_status: int, hub_status: int = 200, verified=" Ada@Example.com "
):
    """Legacy calls answer legacy_status, hub calls hub_status (told apart by key)."""
    seen: list[httpx.Request] = []

    def handler(r: httpx.Request) -> httpx.Response:
        seen.append(r)
        if r.headers["x-api-key"] == HUB_KEY:
            if r.url.path.endswith("/balance"):
                return httpx.Response(
                    200, json={"balances": [{"credit_type_id": "ct-aw3", "balance": 7}]}
                )
            return httpx.Response(hub_status, json={"success": hub_status == 200})
        if r.url.path.endswith("/balance"):
            return httpx.Response(
                200, json={"balances": [{"credit_type_id": "x", "balance": 2}]}
            )
        return httpx.Response(legacy_status, json={"success": legacy_status == 200})

    svc = CreditsService(
        email_lookup=lambda uid: "ada@example.com",
        aw3_email_lookup=lambda uid: verified,
        api_key="cred-key",
        api_base=BASE,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    return svc, seen


def _hub(seen):
    return [r for r in seen if r.headers["x-api-key"] == HUB_KEY]


class TestAw3Chooser:
    def test_legacy_enough_charges_legacy_only(self, monkeypatch):
        _aw3_on(monkeypatch)
        svc, seen = _aw3_service(200)
        assert _run(svc.charge("u", 3)) == "app"
        assert _hub(seen) == []

    def test_legacy_short_charges_all_to_aw3(self, monkeypatch):
        _aw3_on(monkeypatch)
        svc, seen = _aw3_service(402)
        assert _run(svc.charge("u", 3, "OpenEye API /v1/detect")) == "aw3"
        req = _hub(seen)[0]
        assert str(req.url) == f"{BASE}/credits-api/deduct"
        assert req.headers["Idempotency-Key"].startswith("openeye:deduct:")
        assert req.headers["x-app-origin"] == "https://openeye.sh"
        body = json.loads(req.content)
        assert body == {
            "user_id": "ada@example.com",
            "user_email": "ada@example.com",
            "credit_type_id": "ct-aw3",
            "amount": 3,
            "reason": "OpenEye: API /v1/detect",
        }

    def test_both_short_is_refused(self, monkeypatch):
        _aw3_on(monkeypatch)
        svc, seen = _aw3_service(402, hub_status=402)
        assert _run(svc.charge("u", 3)) is None
        assert _run(svc.check_and_deduct("u", 3)) is False

    def test_hub_down_falls_back_to_legacy_refusal(self, monkeypatch):
        _aw3_on(monkeypatch)
        svc, _ = _aw3_service(402, hub_status=503)
        assert _run(svc.charge("u", 3)) is None

    def test_aw3_off_is_todays_behaviour(self, monkeypatch):
        monkeypatch.setenv("AW3_CRED_API_KEY", HUB_KEY)  # partial config = off
        svc, seen = _aw3_service(402)
        assert _run(svc.charge("u", 3)) is None
        assert _run(svc.get_balance("u")) == 2
        assert _hub(seen) == []

    def test_unverified_email_is_legacy_only(self, monkeypatch):
        _aw3_on(monkeypatch)
        svc, seen = _aw3_service(402, verified=None)
        assert _run(svc.charge("u", 3)) is None
        assert _hub(seen) == []

    def test_refund_goes_to_recorded_source(self, monkeypatch):
        _aw3_on(monkeypatch)
        svc, seen = _aw3_service(200)
        assert _run(svc.refund("u", 3, source="aw3")) is True
        hub = _hub(seen)
        assert len(hub) == 1 and str(hub[0].url) == f"{BASE}/credits-api/issue"
        assert hub[0].headers["Idempotency-Key"].startswith("openeye:refund:")
        seen.clear()
        assert _run(svc.refund("u", 3)) is True
        assert _hub(seen) == [] and seen[0].url.path.endswith("/issue")

    def test_balance_is_legacy_plus_aw3(self, monkeypatch):
        _aw3_on(monkeypatch)
        svc, seen = _aw3_service(200)
        assert _run(svc.get_balance("u")) == 9
        assert _hub(seen)[0].url.params["email"] == "ada@example.com"
