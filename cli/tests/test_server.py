"""Tests for FastAPI server endpoints."""

import base64
import io
from pathlib import Path
from typing import Any
from unittest.mock import patch

from PIL import Image

from openeye_ai.adapters.base import ModelAdapter


# ── Health endpoint ──────────────────────────────────────────────────


def test_health_endpoint(app_client):
    resp = app_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["model"] == "fake-model"


def test_health_includes_uptime(app_client):
    data = app_client.get("/health").json()
    assert "uptime_seconds" in data
    assert data["uptime_seconds"] >= 0


def test_health_includes_model_loaded(app_client):
    data = app_client.get("/health").json()
    assert data["model_loaded"] is True


# ── Predict endpoint ─────────────────────────────────────────────────


def test_predict_endpoint(app_client, tiny_image_bytes):
    resp = app_client.post(
        "/predict",
        files={"file": ("test.jpg", tiny_image_bytes, "image/jpeg")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["model"] == "fake-model"
    assert data["task"] == "detection"
    assert "objects" in data
    assert len(data["objects"]) == 1
    assert data["objects"][0]["label"] == "person"
    assert "image" in data
    assert data["image"]["width"] == 10
    assert data["image"]["height"] == 10


def test_predict_response_shape(app_client, tiny_image_bytes):
    resp = app_client.post(
        "/predict",
        files={"file": ("img.jpg", tiny_image_bytes, "image/jpeg")},
    )
    data = resp.json()
    required_keys = {"model", "task", "timestamp", "image", "objects", "inference_ms"}
    assert required_keys.issubset(data.keys())


def test_predict_invalid_image(app_client):
    resp = app_client.post(
        "/predict",
        files={"file": ("bad.jpg", b"not an image", "image/jpeg")},
    )
    assert resp.status_code == 400
    assert "error" in resp.json()


def test_predict_empty_file(app_client):
    resp = app_client.post(
        "/predict",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert resp.status_code == 400
    assert "error" in resp.json()


def test_predict_png_image(app_client):
    """Predict should accept PNG as well as JPEG."""
    img = Image.new("RGB", (5, 5), color="green")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    resp = app_client.post(
        "/predict",
        files={"file": ("test.png", buf.getvalue(), "image/png")},
    )
    assert resp.status_code == 200
    assert resp.json()["image"]["width"] == 5


def test_predict_no_filename(app_client, tiny_image_bytes):
    """When filename is empty, server may reject with 422 or accept."""
    resp = app_client.post(
        "/predict",
        files={"file": ("", tiny_image_bytes, "image/jpeg")},
    )
    assert resp.status_code in (200, 422)


def test_predict_adapter_exception():
    """When adapter.predict raises, server returns 500."""
    from starlette.testclient import TestClient

    from openeye_ai.server.app import create_app
    from openeye_ai.server.rate_limit import limiter

    class ErrorAdapter(ModelAdapter):
        def _do_load(self, model_dir: Path) -> None:
            pass

        def _do_predict(self, image: Image.Image) -> dict[str, Any]:
            raise RuntimeError("GPU out of memory")

        def pull(self, model_dir: Path) -> None:
            pass

    limiter.reset()
    adapter = ErrorAdapter()
    adapter.load(Path("/tmp/err"))
    app = create_app(adapter, "err-model", {"name": "Err", "task": "detection"})
    client = TestClient(app)

    img = Image.new("RGB", (5, 5))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    resp = client.post(
        "/predict",
        files={"file": ("test.jpg", buf.getvalue(), "image/jpeg")},
    )
    assert resp.status_code == 500
    assert "GPU out of memory" in resp.json()["error"]


# ── Config endpoints ─────────────────────────────────────────────────


def test_config_get_put(app_client):
    resp = app_client.get("/config")
    assert resp.status_code == 200
    assert resp.json() == {}

    app_client.put("/config", json={"threshold": 0.5})
    resp = app_client.get("/config")
    assert resp.json() == {"threshold": 0.5}


def test_config_put_replaces_entirely(app_client):
    app_client.put("/config", json={"a": 1, "b": 2})
    app_client.put("/config", json={"c": 3})
    data = app_client.get("/config").json()
    assert data == {"c": 3}
    assert "a" not in data


def test_config_put_empty(app_client):
    app_client.put("/config", json={"key": "val"})
    app_client.put("/config", json={})
    assert app_client.get("/config").json() == {}


# ── Queue status endpoint ────────────────────────────────────────────


def test_queue_status_endpoint(app_client):
    resp = app_client.get("/queue/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active"] == 0
    assert data["queued"] == 0


# ── Metrics endpoint ─────────────────────────────────────────────────


def test_metrics_endpoint_exists(app_client):
    resp = app_client.get("/metrics")
    assert resp.status_code == 200


# ── WebSocket ────────────────────────────────────────────────────────


def test_websocket_valid_image(app_client, tiny_image_bytes):
    b64 = base64.b64encode(tiny_image_bytes).decode()
    with app_client.websocket_connect("/ws") as ws:
        ws.send_text(b64)
        data = ws.receive_json()
        assert data["model"] == "fake-model"
        assert "objects" in data
        assert data["image"]["source"] == "websocket"


def test_websocket_invalid_base64(app_client):
    with app_client.websocket_connect("/ws") as ws:
        ws.send_text("not-valid-base64!!!")
        data = ws.receive_json()
        assert "error" in data


def test_websocket_camera_command(app_client):
    with app_client.websocket_connect("/ws") as ws:
        ws.send_text("camera")
        data = ws.receive_json()
        assert "error" in data
        assert "camera" in data["error"].lower()


def test_websocket_valid_base64_but_not_image(app_client):
    b64 = base64.b64encode(b"this is not an image").decode()
    with app_client.websocket_connect("/ws") as ws:
        ws.send_text(b64)
        data = ws.receive_json()
        assert "error" in data
