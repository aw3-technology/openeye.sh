"""Tests for model registry."""

import pytest

from openeye_ai.registry import (
    get_model_info,
    get_variant_info,
    is_downloaded,
    is_variant_downloaded,
    load_registry,
)


def test_load_registry_returns_dict():
    registry = load_registry()
    assert isinstance(registry, dict)
    assert len(registry) > 0


def test_load_registry_contains_known_models():
    registry = load_registry()
    assert "yolov8" in registry
    assert "depth-anything" in registry
    assert "grounding-dino" in registry


def test_load_registry_models_have_required_fields():
    registry = load_registry()
    for name, info in registry.items():
        assert "name" in info, f"{name} missing 'name'"
        assert "task" in info, f"{name} missing 'task'"
        assert "adapter" in info, f"{name} missing 'adapter'"


def test_get_model_info_valid():
    info = get_model_info("yolov8")
    assert info["name"] == "YOLOv8"
    assert info["task"] == "detection"
    assert "adapter" in info


def test_get_model_info_invalid():
    with pytest.raises(KeyError, match="Unknown model"):
        get_model_info("nonexistent-model-xyz")


def test_get_model_info_empty_string():
    with pytest.raises(KeyError, match="Unknown model"):
        get_model_info("")


def test_get_model_info_error_lists_available(self=None):
    """Error message should list available models."""
    with pytest.raises(KeyError, match="yolov8"):
        get_model_info("bad-name")


def test_get_variant_info_valid():
    info = get_variant_info("yolov8", "quantized")
    assert info["_variant"] == "quantized"
    # Should inherit parent fields
    assert info["task"] == "detection"
    # Should override with variant-specific fields
    assert info["adapter"] == "yolov8:onnx"


def test_get_variant_info_invalid_model():
    with pytest.raises(KeyError, match="Unknown model"):
        get_variant_info("nonexistent", "quantized")


def test_get_variant_info_invalid_variant():
    with pytest.raises(KeyError, match="Unknown variant"):
        get_variant_info("yolov8", "nonexistent-variant")


def test_get_variant_info_model_without_variants():
    """depth-anything has no variants in the registry."""
    with pytest.raises(KeyError, match="Unknown variant"):
        get_variant_info("depth-anything", "anything")


def test_is_downloaded_false_by_default(tmp_openeye_home, monkeypatch):
    monkeyed_models = tmp_openeye_home / "models"
    monkeyed_models.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("openeye_ai.registry.MODELS_DIR", monkeyed_models)
    assert not is_downloaded("yolov8")


def test_is_downloaded_true_with_marker(tmp_path, monkeypatch):
    models_dir = tmp_path / "models"
    monkeypatch.setattr("openeye_ai.config.MODELS_DIR", models_dir)
    monkeypatch.setattr("openeye_ai.registry.MODELS_DIR", models_dir)

    model_dir = models_dir / "yolov8"
    model_dir.mkdir(parents=True)
    (model_dir / ".pulled").touch()

    assert is_downloaded("yolov8")


def test_is_downloaded_dir_exists_but_no_marker(tmp_path, monkeypatch):
    models_dir = tmp_path / "models"
    monkeypatch.setattr("openeye_ai.registry.MODELS_DIR", models_dir)

    model_dir = models_dir / "yolov8"
    model_dir.mkdir(parents=True)
    # dir exists but no .pulled marker
    assert not is_downloaded("yolov8")


def test_is_variant_downloaded(tmp_path, monkeypatch):
    models_dir = tmp_path / "models"
    monkeypatch.setattr("openeye_ai.registry.MODELS_DIR", models_dir)

    variant_dir = models_dir / "yolov8" / ".variant-quantized"
    variant_dir.mkdir(parents=True)
    (variant_dir / ".pulled").touch()

    assert is_variant_downloaded("yolov8", "quantized")


def test_is_variant_downloaded_false(tmp_path, monkeypatch):
    models_dir = tmp_path / "models"
    monkeypatch.setattr("openeye_ai.registry.MODELS_DIR", models_dir)
    assert not is_variant_downloaded("yolov8", "quantized")
