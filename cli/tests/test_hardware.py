"""Tests for openeye_ai.utils.hardware."""

from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock

import pytest

from openeye_ai.utils.hardware import detect_hardware, format_hardware_tags


# ── detect_hardware ──────────────────────────────────────────────────


def test_always_has_cpu():
    hw = detect_hardware()
    assert hw["cpu"] is True


def test_without_torch(monkeypatch):
    """When torch is not installed, only CPU should be detected."""
    import openeye_ai.utils.hardware as hw_mod

    original_import = __builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__

    def _fake_import(name, *args, **kwargs):
        if name == "torch":
            raise ImportError("No module named 'torch'")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr("builtins.__import__", _fake_import)
    hw = detect_hardware()
    assert hw["cpu"] is True
    assert hw["cuda"] is False
    assert hw["mps"] is False


def test_with_cuda_available(monkeypatch):
    """Mock torch with CUDA available."""
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = True
    mock_torch.backends.mps.is_available.return_value = False
    monkeypatch.setitem(sys.modules, "torch", mock_torch)

    hw = detect_hardware()
    assert hw["cpu"] is True
    assert hw["cuda"] is True
    assert hw["mps"] is False


def test_with_mps_available(monkeypatch):
    """Mock torch with MPS available."""
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = False
    mock_torch.backends.mps.is_available.return_value = True
    monkeypatch.setitem(sys.modules, "torch", mock_torch)

    hw = detect_hardware()
    assert hw["cpu"] is True
    assert hw["cuda"] is False
    assert hw["mps"] is True


# ── format_hardware_tags ─────────────────────────────────────────────


def test_format_cpu_only():
    result = format_hardware_tags({"cpu": True, "cuda": False, "mps": False})
    assert "CPU" in result
    assert "CUDA" not in result
    assert "MPS" not in result


def test_format_cpu_and_cuda():
    result = format_hardware_tags({"cpu": True, "cuda": True, "mps": False})
    assert "CPU" in result
    assert "CUDA" in result
    assert "MPS" not in result


def test_format_all_hardware():
    result = format_hardware_tags({"cpu": True, "cuda": True, "mps": True})
    assert "CPU" in result
    assert "CUDA" in result
    assert "MPS" in result


def test_format_empty_dict():
    result = format_hardware_tags({})
    assert "none" in result


def test_format_all_false():
    result = format_hardware_tags({"cpu": False, "cuda": False, "mps": False})
    assert "none" in result
