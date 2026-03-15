"""Tests for openeye_ai.utils.validation."""

from __future__ import annotations

import pytest

from openeye_ai.utils.validation import ValidationError, validate_model_entry


def _valid_entry(**overrides) -> dict:
    """Return a minimal valid model entry, with optional overrides."""
    base = {
        "name": "TestModel",
        "task": "detection",
        "adapter": "yolo",
        "description": "A test model",
        "hf_repo": "test/model",
        "filename": "model.pt",
        "size_mb": 100,
    }
    base.update(overrides)
    return base


# ── Valid entries ────────────────────────────────────────────────────


def test_valid_entry_passes():
    validate_model_entry(_valid_entry())


def test_valid_entry_custom_adapter():
    entry = {
        "name": "Custom",
        "task": "detection",
        "adapter": "/path/to/adapter.py",
        "description": "Custom adapter model",
    }
    validate_model_entry(entry, allow_custom_adapter=True)


# ── Missing required fields ─────────────────────────────────────────


def test_missing_required_field_raises():
    entry = _valid_entry()
    del entry["name"]
    with pytest.raises(ValidationError, match="name"):
        validate_model_entry(entry)


def test_missing_hf_repo_raises_without_custom_adapter():
    entry = _valid_entry()
    del entry["hf_repo"]
    with pytest.raises(ValidationError, match="hf_repo"):
        validate_model_entry(entry)


def test_missing_hf_repo_ok_with_custom_adapter():
    entry = {
        "name": "Custom",
        "task": "depth",
        "adapter": "custom.py",
        "description": "Custom",
    }
    validate_model_entry(entry, allow_custom_adapter=True)


# ── Invalid task ─────────────────────────────────────────────────────


def test_invalid_task_raises():
    with pytest.raises(ValidationError, match="Invalid task"):
        validate_model_entry(_valid_entry(task="invalid-task"))


@pytest.mark.parametrize("task", ["detection", "depth", "segmentation", "classification", "embedding", "vla"])
def test_all_valid_tasks_pass(task):
    validate_model_entry(_valid_entry(task=task))


# ── Invalid size_mb ──────────────────────────────────────────────────


def test_negative_size_raises():
    with pytest.raises(ValidationError, match="size_mb"):
        validate_model_entry(_valid_entry(size_mb=-10))


def test_zero_size_raises():
    with pytest.raises(ValidationError, match="size_mb"):
        validate_model_entry(_valid_entry(size_mb=0))


def test_string_size_raises():
    with pytest.raises(ValidationError, match="size_mb"):
        validate_model_entry(_valid_entry(size_mb="big"))


# ── Checksum validation ─────────────────────────────────────────────


def test_valid_checksum_passes():
    cs = {"algorithm": "sha256", "value": "a" * 64}
    validate_model_entry(_valid_entry(checksum=cs))


def test_checksum_missing_keys_raises():
    with pytest.raises(ValidationError, match="algorithm"):
        validate_model_entry(_valid_entry(checksum={"value": "abc"}))


def test_checksum_bad_algorithm_raises():
    with pytest.raises(ValidationError, match="Unsupported checksum"):
        validate_model_entry(_valid_entry(checksum={"algorithm": "crc32", "value": "abc"}))


def test_checksum_bad_hex_raises():
    with pytest.raises(ValidationError, match="Invalid SHA-256"):
        validate_model_entry(_valid_entry(checksum={"algorithm": "sha256", "value": "not-hex"}))


def test_md5_checksum_passes():
    cs = {"algorithm": "md5", "value": "d41d8cd98f00b204e9800998ecf8427e"}
    validate_model_entry(_valid_entry(checksum=cs))


# ── Variant validation ───────────────────────────────────────────────


def test_variant_missing_filename_raises():
    entry = _valid_entry(variants={"quantized": {"size_mb": 10}})
    with pytest.raises(ValidationError, match="filename"):
        validate_model_entry(entry)


def test_variant_with_valid_checksum_passes():
    entry = _valid_entry(
        variants={
            "quantized": {
                "filename": "model_q.pt",
                "checksum": {"algorithm": "sha256", "value": "b" * 64},
            }
        }
    )
    validate_model_entry(entry)


def test_variant_with_invalid_checksum_raises():
    entry = _valid_entry(
        variants={
            "quantized": {
                "filename": "model_q.pt",
                "checksum": {"algorithm": "sha256", "value": "xyz"},
            }
        }
    )
    with pytest.raises(ValidationError, match="Invalid SHA-256"):
        validate_model_entry(entry)
