"""Tests for the ``openeye api`` CLI client commands."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

from openeye_ai.cli import app
from PIL import Image
from typer.testing import CliRunner

runner = CliRunner()

_MODULE = "openeye_ai.commands.api_cli"


def _make_jpeg(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (10, 10), color="blue")
    img.save(path, format="JPEG")
    return path


def _set_key(monkeypatch, key: str = "oe_test123") -> None:
    """Patch the module-level _API_KEY (set at import time)."""
    monkeypatch.setattr(f"{_MODULE}._API_KEY", key)


# ── api detect ──────────────────────────────────────────────────────


def test_api_detect_success(tmp_path, monkeypatch):
    img_path = _make_jpeg(tmp_path / "photo.jpg")
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "objects": [
            {"label": "car", "confidence": 0.92},
            {"label": "person", "confidence": 0.81},
        ],
        "credits_used": 1,
    }

    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "detect", str(img_path)])
    assert result.exit_code == 0
    assert "2 objects detected" in result.output
    assert "car" in result.output
    assert "person" in result.output


def test_api_detect_pretty_json(tmp_path, monkeypatch):
    img_path = _make_jpeg(tmp_path / "photo.jpg")
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"objects": [], "credits_used": 0}

    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "detect", str(img_path), "--pretty"])
    assert result.exit_code == 0
    assert '"objects"' in result.output


def test_api_detect_missing_file(tmp_path, monkeypatch):
    _set_key(monkeypatch)
    result = runner.invoke(app, ["api", "detect", str(tmp_path / "nope.jpg")])
    assert result.exit_code == 1
    assert "not found" in result.output.lower()


def test_api_detect_missing_key(tmp_path, monkeypatch):
    img_path = _make_jpeg(tmp_path / "photo.jpg")
    _set_key(monkeypatch, "")

    result = runner.invoke(app, ["api", "detect", str(img_path)])
    assert result.exit_code == 1
    assert "OPENEYE_API_KEY" in result.output


def test_api_detect_connect_error(tmp_path, monkeypatch):
    img_path = _make_jpeg(tmp_path / "photo.jpg")
    _set_key(monkeypatch)

    import httpx

    def _fail(*a, **kw):
        raise httpx.ConnectError("Connection refused")

    monkeypatch.setattr("httpx.request", _fail)

    result = runner.invoke(app, ["api", "detect", str(img_path)])
    assert result.exit_code == 1
    assert "Cannot connect" in result.output


def test_api_detect_http_error(tmp_path, monkeypatch):
    img_path = _make_jpeg(tmp_path / "photo.jpg")
    _set_key(monkeypatch)

    import httpx

    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = "Unauthorized"

    def _raise(*a, **kw):
        raise httpx.HTTPStatusError("401", request=MagicMock(), response=mock_resp)

    mock_resp.raise_for_status = _raise

    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "detect", str(img_path)])
    assert result.exit_code == 1
    assert "Error 401" in result.output


# ── api usage ───────────────────────────────────────────────────────


def test_api_usage_success(monkeypatch):
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    # Shape returned by the hosted API (api/v1.ts handleUsage)
    mock_resp.json.return_value = {
        "balance": 850,
        "credits_remaining": 850,
        "total_requests": 42,
        "total_calls": 42,
        "total_credits_used": 150,
        "credits_used": 150,
        "by_endpoint": {"/v1/detect": 30, "/v1/describe": 12},
        "daily_credits": {"2026-11-01": 150},
        "truncated": False,
    }

    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "usage", "--days", "7"])
    assert result.exit_code == 0
    assert "850" in result.stdout
    assert "150" in result.stdout
    assert "42" in result.stdout
    assert "/v1/detect" in result.stdout
    assert "30 calls" in result.stdout
    assert "/v1/describe" in result.stdout


def test_api_usage_falls_back_to_alias_keys(monkeypatch):
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "balance": 77,
        "total_requests": 5,
        "total_credits_used": 9,
    }
    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "usage"])
    assert result.exit_code == 0
    assert "77" in result.stdout
    assert "5" in result.stdout
    assert "9" in result.stdout


def test_api_usage_default_days(monkeypatch):
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "credits_remaining": 1000,
        "credits_used": 0,
        "total_calls": 0,
    }

    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "usage"])
    assert result.exit_code == 0
    assert "Last 30 days" in result.output


def test_api_usage_connect_error(monkeypatch):
    _set_key(monkeypatch)

    import httpx

    def _fail(*a, **kw):
        raise httpx.ConnectError("Connection refused")

    monkeypatch.setattr("httpx.request", _fail)

    result = runner.invoke(app, ["api", "usage"])
    assert result.exit_code == 1
    assert "Cannot connect" in result.output


def test_api_usage_missing_key(monkeypatch):
    _set_key(monkeypatch, "")

    result = runner.invoke(app, ["api", "usage"])
    assert result.exit_code == 1
    assert "OPENEYE_API_KEY" in result.output


# ── api depth ───────────────────────────────────────────────────────


def test_api_depth_success(tmp_path, monkeypatch):
    img_path = _make_jpeg(tmp_path / "photo.jpg")
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "model": "depth-anything",
        "image": {"width": 640, "height": 480},
        "depth_map": _depth_png_b64(),
        "credits_used": 2,
    }

    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "depth", str(img_path)])
    assert result.exit_code == 0
    assert "Depth estimation complete" in result.output
    assert "640x480" in result.output
    assert "depth-anything" in result.output
    assert "use --output to save" in result.output


def _depth_png_b64() -> str:
    import base64
    import io

    buf = io.BytesIO()
    Image.new("L", (4, 3), color=128).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def test_api_depth_saves_output(tmp_path, monkeypatch):
    img_path = _make_jpeg(tmp_path / "photo.jpg")
    out_path = tmp_path / "depth.png"
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "image": {"width": 4, "height": 3},
        "depth_map": _depth_png_b64(),
        "credits_used": 2,
    }
    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(
        app, ["api", "depth", str(img_path), "--output", str(out_path)]
    )
    assert result.exit_code == 0, result.output
    assert "Saved depth map" in result.output
    assert Image.open(out_path).size == (4, 3)


def test_api_depth_legacy_fields(tmp_path, monkeypatch):
    img_path = _make_jpeg(tmp_path / "photo.jpg")
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"width": 64, "height": 48, "credits_used": 2}
    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "depth", str(img_path)])
    assert result.exit_code == 0
    assert "64x48" in result.output
    assert "No depth map returned" in result.output


# ── api describe ────────────────────────────────────────────────────


def test_api_describe_success(tmp_path, monkeypatch):
    img_path = _make_jpeg(tmp_path / "photo.jpg")
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "description": "A blue square",
        "credits_used": 3,
    }

    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "describe", str(img_path)])
    assert result.exit_code == 0
    assert "A blue square" in result.output
    assert "3 credits" in result.output


# ── api models ──────────────────────────────────────────────────────


def test_api_models_success(monkeypatch):
    _set_key(monkeypatch)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "models": [
            {
                "name": "yolov8",
                "task": "detection",
                "credits_per_call": 1,
                "description": "Fast detection",
            },
        ]
    }

    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "models"])
    assert result.exit_code == 0
    # Table goes to stdout (not stderr) so it can be piped
    assert "yolov8" in result.stdout


def test_api_models_json(monkeypatch):
    import json

    _set_key(monkeypatch)

    payload = {
        "models": [{"name": "yolov8", "task": "detection", "credits_per_call": 1}]
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = payload
    monkeypatch.setattr("httpx.request", MagicMock(return_value=mock_resp))

    result = runner.invoke(app, ["api", "models", "--json"])
    assert result.exit_code == 0
    assert json.loads(result.stdout) == payload
