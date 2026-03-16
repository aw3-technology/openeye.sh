"""Tests for the hosted V1 API server routes (/v1/*)."""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any

import pytest
from PIL import Image
from starlette.testclient import TestClient

from openeye_ai.adapters.base import ModelAdapter
from openeye_ai.server.app import create_app
from openeye_ai.server.rate_limit import limiter
from openeye_ai.server.routes.v1 import _UsageLedger

_AUTH = {"Authorization": "Bearer oe_testkey123"}


class _FakeAdapter(ModelAdapter):
    def _do_load(self, model_dir: Path) -> None:
        pass

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        return {
            "objects": [
                {"label": "person", "confidence": 0.95, "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}},
                {"label": "cat", "confidence": 0.40, "bbox": {"x": 0.5, "y": 0.5, "w": 0.2, "h": 0.2}},
            ],
            "inference_ms": 2.5,
        }

    def pull(self, model_dir: Path) -> None:
        pass


@pytest.fixture()
def v1_client():
    limiter.reset()
    adapter = _FakeAdapter()
    adapter.load(Path("/tmp/fake"))
    app = create_app(adapter, "test-model", {"name": "Test", "task": "detection"})
    app.state.usage_ledger = _UsageLedger(starting_credits=1000)
    return TestClient(app)


@pytest.fixture()
def jpeg_bytes():
    img = Image.new("RGB", (10, 10), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ── Auth ────────────────────────────────────────────────────────────


def test_v1_detect_requires_auth(v1_client, jpeg_bytes):
    resp = v1_client.post("/v1/detect", files={"file": ("img.jpg", jpeg_bytes, "image/jpeg")})
    assert resp.status_code == 422  # missing header


def test_v1_detect_rejects_bad_key(v1_client, jpeg_bytes):
    resp = v1_client.post(
        "/v1/detect",
        files={"file": ("img.jpg", jpeg_bytes, "image/jpeg")},
        headers={"Authorization": "Bearer bad_key"},
    )
    assert resp.status_code == 401


# ── /v1/detect ──────────────────────────────────────────────────────


def test_v1_detect_success(v1_client, jpeg_bytes):
    resp = v1_client.post(
        "/v1/detect",
        files={"file": ("photo.jpg", jpeg_bytes, "image/jpeg")},
        headers=_AUTH,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["model"] == "test-model"
    assert len(data["objects"]) == 2
    assert data["credits_used"] == 1
    assert data["objects"][0]["label"] == "person"


def test_v1_detect_confidence_filter(v1_client, jpeg_bytes):
    resp = v1_client.post(
        "/v1/detect",
        files={"file": ("photo.jpg", jpeg_bytes, "image/jpeg")},
        headers=_AUTH,
        params={"confidence": 0.5},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["objects"]) == 1
    assert data["objects"][0]["label"] == "person"


def test_v1_detect_invalid_image(v1_client):
    resp = v1_client.post(
        "/v1/detect",
        files={"file": ("bad.jpg", b"not-an-image", "image/jpeg")},
        headers=_AUTH,
    )
    assert resp.status_code == 400


def test_v1_detect_empty_file(v1_client):
    resp = v1_client.post(
        "/v1/detect",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
        headers=_AUTH,
    )
    assert resp.status_code == 400


# ── /v1/depth ───────────────────────────────────────────────────────


def test_v1_depth_success(v1_client, jpeg_bytes):
    resp = v1_client.post(
        "/v1/depth",
        files={"file": ("img.jpg", jpeg_bytes, "image/jpeg")},
        headers=_AUTH,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["width"] == 10
    assert data["height"] == 10
    assert data["credits_used"] == 2


# ── /v1/describe ────────────────────────────────────────────────────


def test_v1_describe_success(v1_client, jpeg_bytes):
    resp = v1_client.post(
        "/v1/describe",
        files={"file": ("img.jpg", jpeg_bytes, "image/jpeg")},
        headers=_AUTH,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["credits_used"] == 5
    assert "inference_ms" in data


# ── /v1/models ──────────────────────────────────────────────────────


def test_v1_models_lists_loaded(v1_client):
    resp = v1_client.get("/v1/models", headers=_AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["models"]) == 1
    assert data["models"][0]["name"] == "test-model"
    assert data["models"][0]["task"] == "detection"
    assert "credits_per_call" in data["models"][0]


# ── /v1/usage ───────────────────────────────────────────────────────


def test_v1_usage_empty(v1_client):
    resp = v1_client.get("/v1/usage", headers=_AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["credits_remaining"] == 1000
    assert data["credits_used"] == 0
    assert data["total_calls"] == 0


def test_v1_usage_after_detect(v1_client, jpeg_bytes):
    # Make a detect call first
    v1_client.post(
        "/v1/detect",
        files={"file": ("img.jpg", jpeg_bytes, "image/jpeg")},
        headers=_AUTH,
    )
    resp = v1_client.get("/v1/usage", headers=_AUTH, params={"days": 30})
    assert resp.status_code == 200
    data = resp.json()
    assert data["credits_used"] == 1
    assert data["credits_remaining"] == 999
    assert data["total_calls"] == 1
    assert "test-model" in data["by_model"]
    assert data["by_model"]["test-model"]["calls"] == 1


def test_v1_usage_accumulates(v1_client, jpeg_bytes):
    # 2 detects + 1 depth = 1+1+2 = 4 credits, 3 calls
    for _ in range(2):
        v1_client.post(
            "/v1/detect",
            files={"file": ("img.jpg", jpeg_bytes, "image/jpeg")},
            headers=_AUTH,
        )
    v1_client.post(
        "/v1/depth",
        files={"file": ("img.jpg", jpeg_bytes, "image/jpeg")},
        headers=_AUTH,
    )

    data = v1_client.get("/v1/usage", headers=_AUTH).json()
    assert data["credits_used"] == 4
    assert data["credits_remaining"] == 996
    assert data["total_calls"] == 3


def test_v1_usage_requires_auth(v1_client):
    resp = v1_client.get("/v1/usage")
    assert resp.status_code == 422


def test_v1_usage_days_param(v1_client):
    resp = v1_client.get("/v1/usage", headers=_AUTH, params={"days": 7})
    assert resp.status_code == 200
    data = resp.json()
    assert data["credits_remaining"] == 1000
