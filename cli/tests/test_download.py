"""Tests for download utilities."""

from openeye_ai.utils.download import mark_pulled


def test_mark_pulled_creates_marker(tmp_path):
    model_dir = tmp_path / "models" / "yolov8"
    assert not model_dir.exists()

    mark_pulled(model_dir)

    assert model_dir.exists()
    assert (model_dir / ".pulled").exists()


def test_mark_pulled_idempotent(tmp_path):
    model_dir = tmp_path / "models" / "test-model"
    mark_pulled(model_dir)
    mark_pulled(model_dir)  # Should not raise
    assert (model_dir / ".pulled").exists()
