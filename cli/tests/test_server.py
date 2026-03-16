"""Tests for FastAPI server endpoints — stories 38–50."""

import base64
import io
import json
from pathlib import Path
from typing import Any
from unittest.mock import patch

from PIL import Image

from openeye_ai.adapters.base import ModelAdapter


# ── Story 38: openeye serve → REST API at /predict ──────────────────


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
    assert "Inference failed" in resp.json()["error"]


# ── Story 39: Dashboard at / with live inference stats ──────────────


def test_dashboard_serves_html(app_client):
    resp = app_client.get("/")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "OpenEye Dashboard" in resp.text


def test_dashboard_has_websocket_connection(app_client):
    """Dashboard JS connects to /ws for real-time inference."""
    html = app_client.get("/").text
    assert "/ws" in html


def test_dashboard_has_live_stats(app_client):
    """Dashboard includes stats elements for model, latency, FPS, object count."""
    html = app_client.get("/").text
    assert "s-model" in html
    assert "s-latency" in html
    assert "s-fps" in html
    assert "s-count" in html


def test_dashboard_has_camera_and_upload(app_client):
    """Dashboard supports camera feed and image upload."""
    html = app_client.get("/").text
    assert "camera-feed" in html
    assert "upload" in html.lower()


# ── Story 40: POST /predict returns JSON detections ─────────────────
# (covered by test_predict_endpoint and test_predict_response_shape above)


# ── Story 41: WebSocket /ws for real-time streaming ─────────────────


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


def test_websocket_multiple_frames(app_client, tiny_image_bytes):
    """Streaming multiple frames should work sequentially."""
    b64 = base64.b64encode(tiny_image_bytes).decode()
    with app_client.websocket_connect("/ws") as ws:
        for _ in range(3):
            ws.send_text(b64)
            data = ws.receive_json()
            assert "objects" in data


# ── Story 42: /ws/perception — scene graph + 3D spatial reasoning ───


def test_websocket_perception_basic(app_client, tiny_image_bytes):
    """Without PerceptionPipeline, /ws/perception falls back to basic detection."""
    b64 = base64.b64encode(tiny_image_bytes).decode()
    with app_client.websocket_connect("/ws/perception") as ws:
        ws.send_text(b64)
        data = ws.receive_json()
        # Fallback mode returns PredictionResult shape
        assert "objects" in data or "model" in data


def test_websocket_perception_invalid_image(app_client):
    b64 = base64.b64encode(b"not an image").decode()
    with app_client.websocket_connect("/ws/perception") as ws:
        ws.send_text(b64)
        data = ws.receive_json()
        assert "error" in data


# ── Story 43: /ws/vlm — VLM reasoning ──────────────────────────────


def test_websocket_vlm_unconfigured(app_client, tiny_image_bytes):
    """Without VLM API key, /ws/vlm returns a 'not configured' message."""
    b64 = base64.b64encode(tiny_image_bytes).decode()
    with app_client.websocket_connect("/ws/vlm") as ws:
        ws.send_text(b64)
        data = ws.receive_json()
        assert "description" in data
        assert "not configured" in data["description"].lower() or "latency_ms" in data


def test_websocket_vlm_response_shape(app_client, tiny_image_bytes):
    """VLM endpoint always returns description, reasoning, latency_ms."""
    b64 = base64.b64encode(tiny_image_bytes).decode()
    with app_client.websocket_connect("/ws/vlm") as ws:
        ws.send_text(b64)
        data = ws.receive_json()
        assert "description" in data
        assert "reasoning" in data
        assert "latency_ms" in data


# ── Story 44: --vlm-model dual-layer perception ────────────────────


def test_vlm_model_flag_sets_runtime_config():
    """--vlm-model flag should be passed into runtime config."""
    from starlette.testclient import TestClient

    from openeye_ai.server.app import create_app
    from openeye_ai.server.rate_limit import limiter

    from tests.conftest import FakeAdapter

    limiter.reset()
    adapter = FakeAdapter()
    adapter.load(Path("/tmp/vlm"))
    app = create_app(
        adapter, "test-model",
        {"name": "Test", "task": "detection"},
        vlm_model="qwen/qwen3.5-9b",
    )
    client = TestClient(app)

    # Config should contain the VLM model
    resp = client.get("/config")
    assert resp.json()["vlm_model"] == "qwen/qwen3.5-9b"


def test_vlm_model_resolve_openrouter():
    """OpenRouter-style model IDs should be detected correctly."""
    from openeye_ai.server.state import ServerState
    from openeye_ai.server.queue import InferenceQueue

    state = ServerState(
        adapter=None,
        model_name="test",
        model_info={"name": "Test", "task": "detection"},
        inference_queue=InferenceQueue(),
        runtime_config={"vlm_model": "qwen/qwen3.5-9b"},
    )
    _key, base_url, model = state.resolve_vlm_model()
    assert base_url == "https://openrouter.ai/api/v1"
    assert model == "qwen/qwen3.5-9b"


def test_vlm_model_resolve_nebius():
    """Uppercase org model IDs should resolve to Nebius."""
    from openeye_ai.server.state import ServerState
    from openeye_ai.server.queue import InferenceQueue

    state = ServerState(
        adapter=None,
        model_name="test",
        model_info={"name": "Test", "task": "detection"},
        inference_queue=InferenceQueue(),
        runtime_config={"vlm_model": "Qwen/Qwen2.5-VL-72B-Instruct"},
    )
    _key, base_url, model = state.resolve_vlm_model()
    assert "nebius" in base_url or "studio" in base_url
    assert model == "Qwen/Qwen2.5-VL-72B-Instruct"


# ── Story 45: /metrics — Prometheus-compatible metrics ──────────────


def test_metrics_endpoint_exists(app_client):
    resp = app_client.get("/metrics")
    assert resp.status_code == 200


def test_metrics_content_type(app_client):
    resp = app_client.get("/metrics")
    assert "text/plain" in resp.headers["content-type"] or "text/openmetrics" in resp.headers["content-type"]


def test_metrics_contains_openeye_metrics(app_client):
    """Prometheus output should include OpenEye-specific metric names."""
    resp = app_client.get("/metrics")
    body = resp.text
    assert "openeye_requests_total" in body or "openeye_model" in body


def test_metrics_after_predict(app_client, tiny_image_bytes):
    """After a /predict call, inference latency metric should be recorded."""
    app_client.post(
        "/predict",
        files={"file": ("test.jpg", tiny_image_bytes, "image/jpeg")},
    )
    resp = app_client.get("/metrics")
    body = resp.text
    assert "openeye_inference_duration_seconds" in body


# ── Story 46: /health — uptime, model info, status ──────────────────


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


def test_health_includes_task(app_client):
    data = app_client.get("/health").json()
    assert data["task"] == "detection"


def test_health_includes_model_display_name(app_client):
    data = app_client.get("/health").json()
    assert data["model_display_name"] == "FakeModel"


def test_health_includes_queue_status(app_client):
    data = app_client.get("/health").json()
    assert "queue" in data
    assert data["queue"]["active"] == 0
    assert data["queue"]["queued"] == 0


# ── Story 47: /nebius/stats — VLM token usage and costs ─────────────


def test_nebius_stats_endpoint(app_client):
    resp = app_client.get("/nebius/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_calls" in data
    assert "total_tokens_estimated" in data
    assert "uptime_seconds" in data


def test_nebius_stats_includes_cost(app_client):
    resp = app_client.get("/nebius/stats")
    data = resp.json()
    assert "estimated_cost_usd" in data
    assert isinstance(data["estimated_cost_usd"], (int, float))


def test_nebius_stats_cost_proportional_to_tokens(app_client):
    """Cost should scale with token usage."""
    from openeye_ai.server.state import nebius_stats

    original = nebius_stats["total_tokens_estimated"]
    nebius_stats["total_tokens_estimated"] = 5000
    try:
        data = app_client.get("/nebius/stats").json()
        assert data["estimated_cost_usd"] == round(5000 * 0.0002, 4)
    finally:
        nebius_stats["total_tokens_estimated"] = original


def test_nebius_stats_provider_info(app_client):
    data = app_client.get("/nebius/stats").json()
    assert "provider" in data
    assert "configured" in data


# ── Story 48: --demo mode with warm-up + live status bar ────────────


def test_demo_flag_accepted():
    """The serve command should accept --demo flag."""
    import inspect
    from openeye_ai.commands.inference.serve import serve

    sig = inspect.signature(serve)
    assert "demo" in sig.parameters


def test_demo_mode_function_exists():
    """_run_demo_mode function should exist."""
    from openeye_ai.commands.inference.serve import _run_demo_mode

    assert callable(_run_demo_mode)


# ── Story 49: PUT /config without restarting ────────────────────────


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


def test_config_runtime_update_no_restart(app_client):
    """Updating config should take effect immediately without restart."""
    app_client.put("/config", json={"vlm_model": "new-model"})
    data = app_client.get("/config").json()
    assert data["vlm_model"] == "new-model"

    resp = app_client.put("/config", json={"vlm_model": "another"})
    assert resp.json()["status"] == "ok"
    assert app_client.get("/config").json()["vlm_model"] == "another"


# ── Story 50: /queue/status — load awareness ────────────────────────


def test_queue_status_endpoint(app_client):
    resp = app_client.get("/queue/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active"] == 0
    assert data["queued"] == 0


def test_queue_status_has_load_fields(app_client):
    data = app_client.get("/queue/status").json()
    assert "status" in data
    assert "max_queue_size" in data
    assert "capacity_percent" in data


def test_queue_status_idle_when_empty(app_client):
    data = app_client.get("/queue/status").json()
    assert data["status"] == "idle"
    assert data["capacity_percent"] == 0.0


def test_queue_max_queue_size(app_client):
    data = app_client.get("/queue/status").json()
    assert data["max_queue_size"] == 16  # default
