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

    @pytest.mark.parametrize("status", [400, 402, 409, 422])
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
