"""Tests for CLI commands via typer.testing.CliRunner."""

from __future__ import annotations

import io
import shutil
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image
from typer.testing import CliRunner

from openeye_ai.cli import app

runner = CliRunner()


# ── Helpers ──────────────────────────────────────────────────────────


def _make_registry(downloaded: set[str] | None = None) -> dict[str, dict[str, Any]]:
    """Return a small fake registry."""
    return {
        "yolov8": {
            "name": "YOLOv8",
            "task": "detection",
            "adapter": "yolo",
            "description": "Object detection",
            "hf_repo": "ultralytics/yolov8",
            "filename": "yolov8n.pt",
            "size_mb": 25,
            "hardware": {"cpu": True},
            "variants": {
                "quantized": {
                    "filename": "yolov8n_int8.pt",
                    "size_mb": 10,
                }
            },
        },
        "depth-anything": {
            "name": "Depth Anything",
            "task": "depth",
            "adapter": "depth_anything",
            "description": "Monocular depth",
            "hf_repo": "depth/anything",
            "filename": "depth.pt",
            "size_mb": 50,
        },
    }


def _fake_is_downloaded(name: str, downloaded: set[str] | None = None) -> bool:
    return name in (downloaded or set())


def _make_jpeg(path: Path) -> Path:
    """Create a tiny valid JPEG at *path* and return the path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (10, 10), color="red")
    img.save(path, format="JPEG")
    return path


class _StubAdapter:
    """Minimal adapter stub for CLI tests."""

    def pull(self, model_dir: Path) -> None:
        model_dir.mkdir(parents=True, exist_ok=True)

    def load(self, model_dir: Path) -> None:
        pass

    def predict(self, image: Any) -> dict:
        return {
            "objects": [
                {"label": "person", "confidence": 0.9, "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}}
            ],
            "inference_ms": 5.0,
        }


# ── --version / --help ───────────────────────────────────────────────


def test_version_flag():
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert "openeye-sh" in result.output
    assert "0.1.0" in result.output


def test_help_flag():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "Ollama for vision AI" in result.output


# ── list ─────────────────────────────────────────────────────────────


def test_list_renders_table(tmp_openeye_home, monkeypatch):
    registry = _make_registry()
    monkeypatch.setattr("openeye_ai.commands.models.load_registry", lambda: registry)
    monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda k: k == "yolov8")
    monkeypatch.setattr("openeye_ai.commands.models.is_variant_downloaded", lambda k, v: False)

    result = runner.invoke(app, ["list"])
    assert result.exit_code == 0
    assert "yolov8" in result.output
    assert "depth-anything" in result.output


# ── pull ─────────────────────────────────────────────────────────────


def test_pull_success(tmp_openeye_home, monkeypatch):
    registry = _make_registry()
    monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
    monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
    monkeypatch.setattr("openeye_ai.commands.models.get_adapter", lambda m, variant=None: _StubAdapter())
    monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")
    monkeypatch.setattr(
        "shutil.disk_usage",
        lambda p: shutil._ntuple_diskusage(10 * 1024**3, 5 * 1024**3, 5 * 1024**3),
    )
    # verify_checksum and mark_pulled are lazy-imported inside _pull_single
    monkeypatch.setattr("openeye_ai.utils.checksum.verify_checksum", lambda *a, **kw: True)
    monkeypatch.setattr("openeye_ai.utils.download.mark_pulled", lambda d: None)

    result = runner.invoke(app, ["pull", "yolov8"])
    assert result.exit_code == 0
    assert "Successfully pulled" in result.output


def test_pull_unknown_model(tmp_openeye_home, monkeypatch):
    monkeypatch.setattr(
        "openeye_ai.commands.models.get_model_info",
        lambda m: (_ for _ in ()).throw(KeyError(f"Unknown model '{m}'")),
    )

    result = runner.invoke(app, ["pull", "nonexistent"])
    assert result.exit_code == 1


def test_pull_already_downloaded(tmp_openeye_home, monkeypatch):
    registry = _make_registry()
    monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
    monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: True)
    monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")

    result = runner.invoke(app, ["pull", "yolov8"])
    assert result.exit_code == 0
    assert "already downloaded" in result.output


def test_pull_all(tmp_openeye_home, monkeypatch):
    registry = _make_registry()
    monkeypatch.setattr("openeye_ai.commands.models.load_registry", lambda: registry)
    monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
    monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
    monkeypatch.setattr("openeye_ai.commands.models.get_adapter", lambda m, variant=None: _StubAdapter())
    monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")
    monkeypatch.setattr(
        "shutil.disk_usage",
        lambda p: shutil._ntuple_diskusage(10 * 1024**3, 5 * 1024**3, 5 * 1024**3),
    )
    monkeypatch.setattr("openeye_ai.utils.checksum.verify_checksum", lambda *a, **kw: True)
    monkeypatch.setattr("openeye_ai.utils.download.mark_pulled", lambda d: None)

    result = runner.invoke(app, ["pull", "--all"])
    assert result.exit_code == 0
    assert "All models pulled" in result.output


def test_pull_no_model_no_all(tmp_openeye_home):
    result = runner.invoke(app, ["pull"])
    assert result.exit_code == 1
    assert "Provide a model name" in result.output


# ── remove ───────────────────────────────────────────────────────────


def test_remove_not_downloaded(tmp_openeye_home, monkeypatch):
    registry = _make_registry()
    monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
    monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
    monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")

    result = runner.invoke(app, ["remove", "yolov8"])
    assert result.exit_code == 0
    assert "not downloaded" in result.output


# ── run ──────────────────────────────────────────────────────────────


def test_run_model_not_downloaded(tmp_openeye_home, monkeypatch):
    import sys
    import openeye_ai.commands.inference.run  # noqa: F811
    run_mod = sys.modules["openeye_ai.commands.inference.run"]

    registry = _make_registry()
    monkeypatch.setattr(run_mod, "get_model_info", lambda m: registry[m])
    monkeypatch.setattr(run_mod, "is_downloaded", lambda m: False)
    monkeypatch.setattr(run_mod, "MODELS_DIR", tmp_openeye_home / "models")

    result = runner.invoke(app, ["run", "yolov8", "/tmp/fake.jpg"])
    assert result.exit_code == 1
    assert "not downloaded" in result.output


def test_run_missing_image(tmp_openeye_home, monkeypatch):
    import sys
    import openeye_ai.commands.inference.run  # noqa: F811
    run_mod = sys.modules["openeye_ai.commands.inference.run"]

    registry = _make_registry()
    monkeypatch.setattr(run_mod, "get_model_info", lambda m: registry[m])
    monkeypatch.setattr(run_mod, "is_downloaded", lambda m: True)
    monkeypatch.setattr(run_mod, "MODELS_DIR", tmp_openeye_home / "models")

    result = runner.invoke(app, ["run", "yolov8", "/tmp/nonexistent_image_abc123.jpg"])
    assert result.exit_code == 1
    assert "not found" in result.output


def test_run_success(tmp_openeye_home, tmp_path, monkeypatch):
    import sys
    import openeye_ai.commands.inference.run  # noqa: F811
    run_mod = sys.modules["openeye_ai.commands.inference.run"]

    registry = _make_registry()
    img_path = _make_jpeg(tmp_path / "test.jpg")

    monkeypatch.setattr(run_mod, "get_model_info", lambda m: registry[m])
    monkeypatch.setattr(run_mod, "is_downloaded", lambda m: True)
    monkeypatch.setattr(run_mod, "get_adapter", lambda m, variant=None: _StubAdapter())
    monkeypatch.setattr(run_mod, "MODELS_DIR", tmp_openeye_home / "models")

    result = runner.invoke(app, ["run", "yolov8", str(img_path)])
    assert result.exit_code == 0
    assert "person" in result.output


# ── config ───────────────────────────────────────────────────────────


def test_config_set_and_get(tmp_openeye_home, monkeypatch):
    store: dict[str, Any] = {}
    monkeypatch.setattr("openeye_ai.config.set_config_value", lambda k, v: store.update({k: v}))
    monkeypatch.setattr("openeye_ai.config.get_config_value", lambda k: store.get(k))

    result = runner.invoke(app, ["config", "set", "device", "gpu"])
    assert result.exit_code == 0
    assert "gpu" in result.output

    result = runner.invoke(app, ["config", "get", "device"])
    assert result.exit_code == 0
    assert "gpu" in result.output


def test_config_get_missing_key(tmp_openeye_home, monkeypatch):
    monkeypatch.setattr("openeye_ai.config.get_config_value", lambda k: None)

    result = runner.invoke(app, ["config", "get", "nonexistent"])
    assert result.exit_code == 1
    assert "not set" in result.output


# ── health ───────────────────────────────────────────────────────────


def test_health_success(tmp_openeye_home, monkeypatch):
    mock_response = MagicMock()
    mock_response.json.return_value = {"model": "yolov8", "loaded": True, "uptime": "1h"}
    mock_response.raise_for_status = MagicMock()

    mock_get = MagicMock(return_value=mock_response)
    monkeypatch.setattr("httpx.get", mock_get)

    result = runner.invoke(app, ["health", "--server", "http://localhost:9999"])
    assert result.exit_code == 0
    assert "Healthy" in result.output


def test_health_connection_error(tmp_openeye_home, monkeypatch):
    import httpx

    def _fail(*a, **kw):
        raise httpx.ConnectError("Connection refused")

    monkeypatch.setattr("httpx.get", _fail)

    result = runner.invoke(app, ["health", "--server", "http://localhost:9999"])
    assert result.exit_code == 1
    assert "Cannot connect" in result.output


# ── serve (model not downloaded) ─────────────────────────────────────


def test_serve_not_downloaded(tmp_openeye_home, monkeypatch):
    import sys
    import openeye_ai.commands.inference.serve  # noqa: F811
    serve_mod = sys.modules["openeye_ai.commands.inference.serve"]

    registry = _make_registry()
    monkeypatch.setattr(serve_mod, "get_model_info", lambda m: registry[m])
    monkeypatch.setattr(serve_mod, "is_downloaded", lambda m: False)
    monkeypatch.setattr(serve_mod, "MODELS_DIR", tmp_openeye_home / "models")

    result = runner.invoke(app, ["serve", "yolov8"])
    assert result.exit_code == 1
    assert "not downloaded" in result.output
