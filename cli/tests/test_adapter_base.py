"""Tests for the ModelAdapter ABC."""

from pathlib import Path
from typing import Any

import pytest
from PIL import Image

from openeye_ai.adapters.base import ModelAdapter, ModelNotLoadedError


def test_abc_cannot_be_instantiated():
    with pytest.raises(TypeError):
        ModelAdapter()


def test_fake_adapter_load_predict_lifecycle(fake_adapter):
    assert fake_adapter._loaded is True
    img = Image.new("RGB", (10, 10), color="blue")
    result = fake_adapter.predict(img)
    assert "objects" in result
    assert "inference_ms" in result
    assert len(result["objects"]) == 1
    assert result["objects"][0]["label"] == "person"


def test_predict_before_load_raises():
    from tests.conftest import FakeAdapter

    adapter = FakeAdapter()
    img = Image.new("RGB", (10, 10))
    with pytest.raises(ModelNotLoadedError, match="not loaded"):
        adapter.predict(img)


def test_load_sets_loaded_flag():
    from tests.conftest import FakeAdapter

    adapter = FakeAdapter()
    assert adapter._loaded is False
    adapter.load(Path("/tmp/test"))
    assert adapter._loaded is True


def test_load_twice_stays_loaded():
    from tests.conftest import FakeAdapter

    adapter = FakeAdapter()
    adapter.load(Path("/tmp/test1"))
    adapter.load(Path("/tmp/test2"))
    assert adapter._loaded is True


def test_predict_with_various_image_sizes(fake_adapter):
    """Predict should work with different image dimensions."""
    for size in [(1, 1), (100, 100), (1920, 1080)]:
        img = Image.new("RGB", size)
        result = fake_adapter.predict(img)
        assert "objects" in result


def test_predict_with_different_modes(fake_adapter):
    """Adapter receives RGB from predict(), but let's verify it handles it."""
    img = Image.new("RGBA", (10, 10), color=(255, 0, 0, 128))
    # FakeAdapter doesn't care about mode, just returns canned data
    result = fake_adapter.predict(img.convert("RGB"))
    assert result["objects"][0]["label"] == "person"


def test_pull_creates_directory():
    from tests.conftest import FakeAdapter

    import tempfile

    adapter = FakeAdapter()
    with tempfile.TemporaryDirectory() as td:
        model_dir = Path(td) / "new_model"
        adapter.pull(model_dir)
        assert model_dir.exists()


def test_adapter_with_failing_do_load():
    """Adapter that raises during _do_load should not set _loaded."""

    class FailingAdapter(ModelAdapter):
        def _do_load(self, model_dir: Path) -> None:
            raise RuntimeError("load failed")

        def _do_predict(self, image: Image.Image) -> dict[str, Any]:
            return {}

        def pull(self, model_dir: Path) -> None:
            pass

    adapter = FailingAdapter()
    with pytest.raises(RuntimeError, match="load failed"):
        adapter.load(Path("/tmp/bad"))
    assert adapter._loaded is False


def test_adapter_with_failing_do_predict():
    """Adapter that raises during _do_predict propagates the error."""

    class ErrorAdapter(ModelAdapter):
        def _do_load(self, model_dir: Path) -> None:
            pass

        def _do_predict(self, image: Image.Image) -> dict[str, Any]:
            raise ValueError("inference error")

        def pull(self, model_dir: Path) -> None:
            pass

    adapter = ErrorAdapter()
    adapter.load(Path("/tmp/test"))
    img = Image.new("RGB", (10, 10))
    with pytest.raises(ValueError, match="inference error"):
        adapter.predict(img)
