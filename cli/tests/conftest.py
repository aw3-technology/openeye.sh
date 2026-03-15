"""Shared fixtures for CLI tests."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from PIL import Image

from openeye_ai.adapters.base import ModelAdapter


class FakeAdapter(ModelAdapter):
    """No-op adapter for testing — returns canned detection data."""

    def _do_load(self, model_dir: Path) -> None:
        pass

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        w, h = image.size
        return {
            "objects": [
                {
                    "label": "person",
                    "confidence": 0.95,
                    "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4},
                }
            ],
            "inference_ms": 1.23,
        }

    def pull(self, model_dir: Path) -> None:
        model_dir.mkdir(parents=True, exist_ok=True)


@pytest.fixture()
def fake_adapter():
    """Return a loaded FakeAdapter."""
    adapter = FakeAdapter()
    adapter.load(Path("/tmp/fake_model"))
    return adapter


@pytest.fixture()
def tmp_openeye_home(tmp_path, monkeypatch):
    """Redirect OPENEYE_HOME and MODELS_DIR to a temp directory."""
    home = tmp_path / ".openeye"
    models = home / "models"
    monkeypatch.setattr("openeye_ai.config.OPENEYE_HOME", home)
    monkeypatch.setattr("openeye_ai.config.MODELS_DIR", models)
    monkeypatch.setattr("openeye_ai.config.CONFIG_PATH", home / "config.yaml")
    return home


@pytest.fixture()
def app_client(fake_adapter):
    """Return a TestClient wrapping the FastAPI app with a FakeAdapter."""
    from starlette.testclient import TestClient

    from openeye_ai.server.app import create_app
    from openeye_ai.server.rate_limit import limiter

    # Reset rate limiter state between tests
    limiter.reset()

    model_info = {"name": "FakeModel", "task": "detection"}
    app = create_app(fake_adapter, "fake-model", model_info)
    return TestClient(app)


@pytest.fixture()
def tiny_image_bytes():
    """Return bytes of a small 10x10 red JPEG."""
    import io

    img = Image.new("RGB", (10, 10), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()
