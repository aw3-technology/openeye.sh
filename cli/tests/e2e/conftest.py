"""Fixtures for E2E / integration tests."""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image
from typer.testing import CliRunner


@pytest.fixture()
def e2e_home(tmp_path, monkeypatch):
    """Redirect OPENEYE_HOME to a temp dir for E2E tests."""
    home = tmp_path / ".openeye"
    models = home / "models"
    monkeypatch.setattr("openeye_ai.config.OPENEYE_HOME", home)
    monkeypatch.setattr("openeye_ai.config.MODELS_DIR", models)
    monkeypatch.setattr("openeye_ai.config.CONFIG_PATH", home / "config.yaml")
    # Also patch the registry module's reference
    monkeypatch.setattr("openeye_ai.registry.MODELS_DIR", models)
    return home


@pytest.fixture()
def test_image(tmp_path) -> Path:
    """Create a 100x100 JPEG test image."""
    img = Image.new("RGB", (100, 100), color="blue")
    path = tmp_path / "test_image.jpg"
    img.save(path, format="JPEG")
    return path


@pytest.fixture()
def cli_runner():
    """Return a typer CliRunner."""
    return CliRunner()
