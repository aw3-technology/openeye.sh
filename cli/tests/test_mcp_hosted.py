"""MCP server hosted-API tools (openeye_api_*), with httpx mocked."""

from __future__ import annotations

import json

import httpx
import pytest

pytest.importorskip("mcp")

from openeye_ai.mcp import server  # noqa: E402


class _FakeClient:
    """Stands in for httpx.AsyncClient and records the last request."""

    calls: list[dict] = []
    response = httpx.Response(200, json={"ok": True})
    raise_error: Exception | None = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def request(self, method, url, **kwargs):
        _FakeClient.calls.append({"method": method, "url": url, **kwargs})
        if _FakeClient.raise_error:
            raise _FakeClient.raise_error
        return _FakeClient.response


@pytest.fixture(autouse=True)
def fake_http(monkeypatch):
    _FakeClient.calls = []
    _FakeClient.response = httpx.Response(200, json={"ok": True})
    _FakeClient.raise_error = None
    monkeypatch.setattr(httpx, "AsyncClient", _FakeClient)
    monkeypatch.setenv("OPENEYE_API_KEY", "oe_test")
    monkeypatch.delenv("OPENEYE_API_URL", raising=False)
    return _FakeClient


@pytest.fixture()
def image(tmp_path):
    p = tmp_path / "photo.jpg"
    p.write_bytes(b"\xff\xd8\xff fake jpeg")
    return p


@pytest.mark.asyncio
async def test_detect_posts_image_and_confidence(fake_http, image):
    fake_http.response = httpx.Response(
        200, json={"model": "yolov8", "objects": [{"label": "cup"}]}
    )
    out = await server.openeye_api_detect(str(image), confidence=0.4)

    call = fake_http.calls[0]
    assert call["method"] == "POST"
    assert call["url"] == "https://openeye.sh/v1/detect"
    assert call["headers"] == {"Authorization": "Bearer oe_test"}
    assert call["data"] == {"confidence": "0.4"}
    assert call["files"]["file"][0] == "photo.jpg"
    assert json.loads(out)["objects"][0]["label"] == "cup"


@pytest.mark.asyncio
async def test_api_url_override(fake_http, monkeypatch):
    monkeypatch.setenv("OPENEYE_API_URL", "http://localhost:8000/")
    await server.openeye_api_models()
    assert fake_http.calls[0]["url"] == "http://localhost:8000/v1/models"


@pytest.mark.asyncio
async def test_usage_passes_days(fake_http):
    await server.openeye_api_usage(days=7)
    call = fake_http.calls[0]
    assert call["url"] == "https://openeye.sh/v1/usage"
    assert call["params"] == {"days": 7}


@pytest.mark.asyncio
async def test_describe_sends_prompt(fake_http, image):
    await server.openeye_api_describe(str(image), prompt="Is anyone there?")
    assert fake_http.calls[0]["data"] == {"prompt": "Is anyone there?"}


@pytest.mark.asyncio
async def test_missing_key_explains_how_to_get_one(fake_http, monkeypatch, image):
    monkeypatch.delenv("OPENEYE_API_KEY")
    out = await server.openeye_api_detect(str(image))
    assert "OPENEYE_API_KEY is not set" in out
    assert "openeye.sh/dashboard/settings/api-keys" in out
    assert fake_http.calls == []


@pytest.mark.asyncio
async def test_missing_image(fake_http, tmp_path):
    out = await server.openeye_api_detect(str(tmp_path / "nope.jpg"))
    assert out.startswith("Error: image not found")
    assert fake_http.calls == []


@pytest.mark.asyncio
async def test_api_error_is_reported(fake_http, image):
    fake_http.response = httpx.Response(402, json={"error": "Not enough credits."})
    out = await server.openeye_api_detect(str(image))
    assert out == "Error 402: Not enough credits."


@pytest.mark.asyncio
async def test_network_error_is_reported(fake_http, image):
    fake_http.raise_error = httpx.ConnectError("boom")
    out = await server.openeye_api_detect(str(image))
    assert out.startswith("Error: could not reach https://openeye.sh")


def test_tools_registered():
    names = {t.name for t in server.mcp._tool_manager.list_tools()}
    assert {
        "openeye_api_detect",
        "openeye_api_describe",
        "openeye_api_models",
        "openeye_api_usage",
        "openeye_list",
        "openeye_run",
    } <= names
