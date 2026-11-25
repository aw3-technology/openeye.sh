"""CreditsService against a mocked Cred credits API (httpx.MockTransport)."""

from __future__ import annotations

import asyncio
import json
import logging

import httpx
import pytest

from fleet.services import credits_service as cs
from fleet.services.credits_service import Charge, CreditsService

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
        "ELECTRUM_ENABLED",
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


# ── Electrum v2 (cred.diy shared_fallback; mirrors src/test/api/electrum.test.ts) ──


def _electrum_service(deduct_replies=None, verified=" Ada@Example.com "):
    """A fake Cred: /deduct answers the queued replies in turn (the last repeats)."""
    seen: list[httpx.Request] = []
    replies = list(
        deduct_replies
        or [(200, {"success": True, "paid_from": "app", "transaction_id": "tx-app"})]
    )

    def handler(r: httpx.Request) -> httpx.Response:
        seen.append(r)
        if r.url.path.endswith("/deduct"):
            status, body = replies.pop(0) if len(replies) > 1 else replies[0]
            return httpx.Response(status, json=body)
        if r.url.path.endswith("/balance"):
            return httpx.Response(
                200,
                json={
                    "balances": [{"credit_type_id": "x", "balance": 2}],
                    "shared_balance": {"balance": 3.4},
                },
            )
        return httpx.Response(200, json={"success": True})

    svc = CreditsService(
        email_lookup=lambda uid: "ada@example.com",
        aw3_email_lookup=lambda uid: verified,
        api_key="cred-key",
        api_base=BASE,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    return svc, seen


def _deducts(seen):
    return [r for r in seen if r.url.path.endswith("/deduct")]


class TestElectrum:
    def test_one_deduct_with_shared_fallback(self, monkeypatch):
        monkeypatch.setenv("ELECTRUM_ENABLED", "true")
        svc, seen = _electrum_service()
        assert _run(svc.charge("u", 3)) == Charge("app", "tx-app")
        reqs = _deducts(seen)
        assert len(reqs) == 1 and reqs[0].headers["x-api-key"] == "cred-key"
        body = json.loads(reqs[0].content)
        assert body["shared_fallback"] is True
        assert body["user_email"] == "ada@example.com"
        assert body["amount"] == 3

    def test_shared_paid_is_recorded_and_refunded_with_shared(self, monkeypatch):
        monkeypatch.setenv("ELECTRUM_ENABLED", "true")
        svc, seen = _electrum_service(
            [(200, {"success": True, "paid_from": "shared", "transaction_id": "tx-e"})]
        )
        charge = _run(svc.charge("u", 3))
        assert charge == Charge("shared", "tx-e")
        seen.clear()
        assert _run(svc.refund("u", 3, charge=charge)) is True
        assert len(seen) == 1 and seen[0].url.path.endswith("/refund")
        body = json.loads(seen[0].content)
        assert body["transaction_id"] == "tx-e" and body["shared"] is True
        assert "amount" not in body

    def test_app_paid_refund_is_todays_issue(self, monkeypatch):
        monkeypatch.setenv("ELECTRUM_ENABLED", "true")
        svc, seen = _electrum_service()
        assert _run(svc.refund("u", 3, charge=Charge("app", "tx-app"))) is True
        assert seen[0].url.path.endswith("/issue")

    def test_both_short_is_refused(self, monkeypatch):
        monkeypatch.setenv("ELECTRUM_ENABLED", "true")
        svc, seen = _electrum_service([(400, {"code": "INSUFFICIENT_CREDITS"})])
        assert _run(svc.charge("u", 3)) is None
        assert len(_deducts(seen)) == 1

    def test_hub_not_linked_retries_once_without_fallback(self, monkeypatch):
        monkeypatch.setenv("ELECTRUM_ENABLED", "true")
        svc, seen = _electrum_service(
            [
                (400, {"code": "SHARED_RATE_MISSING"}),
                (200, {"success": True, "transaction_id": "tx-app"}),
            ]
        )
        assert _run(svc.charge("u", 3)) == Charge("app", "tx-app")
        first, second = (json.loads(r.content) for r in _deducts(seen))
        assert first["shared_fallback"] is True and "shared_fallback" not in second

    def test_off_sends_no_shared_fields(self):
        svc, seen = _electrum_service()
        assert _run(svc.charge("u", 3)) == Charge("app", "tx-app")
        assert "shared_fallback" not in json.loads(_deducts(seen)[0].content)
        assert _run(svc.get_balances("u")) == (2, None)
        assert all("include_shared" not in str(r.url) for r in seen)

    def test_unverified_email_sends_no_fallback(self, monkeypatch):
        monkeypatch.setenv("ELECTRUM_ENABLED", "true")
        svc, seen = _electrum_service(verified=None)
        _run(svc.charge("u", 3))
        assert "shared_fallback" not in json.loads(_deducts(seen)[0].content)

    def test_balance_keeps_electrum_apart(self, monkeypatch):
        monkeypatch.setenv("ELECTRUM_ENABLED", "true")
        svc, seen = _electrum_service()
        assert _run(svc.get_balances("u")) == (2, 3.4)
        assert _run(svc.get_balance("u")) == 2
        assert seen[0].url.params["include_shared"] == "true"
        assert seen[0].url.params["email"] == "ada@example.com"
