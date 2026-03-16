"""Tests for benchmarking utilities and bench CLI command."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

from openeye_ai.cli import app
from openeye_ai.utils.benchmark import BenchmarkResult, run_benchmark

runner = CliRunner()


# ── BenchmarkResult stats ──────────────────────────────────────────


def _make_result(times: list[float], **kwargs: Any) -> BenchmarkResult:
    defaults = dict(
        model="test",
        variant=None,
        runs=len(times),
        warmup=0,
        image_size=(640, 480),
        times_ms=times,
        hardware={"device": "CPU", "cpu": "Test CPU", "platform": "Test x86_64"},
    )
    defaults.update(kwargs)
    return BenchmarkResult(**defaults)


class TestBenchmarkResult:
    """Story 23 & 24: mean/median/P95/FPS/std/min/max in table."""

    def test_mean(self):
        r = _make_result([10.0, 20.0, 30.0])
        assert r.mean_ms == pytest.approx(20.0)

    def test_median(self):
        r = _make_result([10.0, 20.0, 100.0])
        assert r.median_ms == pytest.approx(20.0)

    def test_std(self):
        r = _make_result([10.0, 20.0, 30.0])
        assert r.std_ms > 0

    def test_std_single_run(self):
        r = _make_result([10.0])
        assert r.std_ms == 0.0

    def test_min_max(self):
        r = _make_result([5.0, 15.0, 25.0])
        assert r.min_ms == pytest.approx(5.0)
        assert r.max_ms == pytest.approx(25.0)

    def test_p95(self):
        times = list(range(1, 101))  # 1..100
        r = _make_result([float(t) for t in times])
        assert r.p95_ms >= 95.0

    def test_fps(self):
        r = _make_result([10.0, 10.0, 10.0])
        assert r.fps == pytest.approx(100.0)

    def test_empty_times(self):
        r = _make_result([])
        assert r.mean_ms == 0.0
        assert r.median_ms == 0.0
        assert r.std_ms == 0.0
        assert r.min_ms == 0.0
        assert r.max_ms == 0.0
        assert r.p95_ms == 0.0
        assert r.fps == 0.0

    def test_hardware_field(self):
        r = _make_result([10.0], hardware={"device": "MPS", "cpu": "Apple M1"})
        assert r.hardware["device"] == "MPS"


# ── run_benchmark ──────────────────────────────────────────────────


class TestRunBenchmark:
    """Story 24: --runs flag for statistically significant results."""

    def test_returns_correct_run_count(self, fake_adapter):
        result = run_benchmark(fake_adapter, runs=5, warmup=1)
        assert result.runs == 5
        assert len(result.times_ms) == 5

    def test_warmup_not_counted(self, fake_adapter):
        result = run_benchmark(fake_adapter, runs=3, warmup=5)
        assert len(result.times_ms) == 3

    def test_custom_resolution(self, fake_adapter):
        """Story 26: benchmark at different resolutions."""
        result = run_benchmark(fake_adapter, runs=2, width=1920, height=1080)
        assert result.image_size == (1920, 1080)

    def test_variant_recorded(self, fake_adapter):
        """Story 25: variant is tracked in result."""
        result = run_benchmark(fake_adapter, variant="quantized", runs=2)
        assert result.variant == "quantized"

    def test_hardware_captured(self, fake_adapter):
        """Story 28: hardware info captured automatically."""
        result = run_benchmark(fake_adapter, runs=2)
        assert "device" in result.hardware
        assert "cpu" in result.hardware
        assert "platform" in result.hardware

    def test_invalid_runs(self, fake_adapter):
        with pytest.raises(ValueError, match="positive"):
            run_benchmark(fake_adapter, runs=0)

    def test_invalid_dimensions(self, fake_adapter):
        with pytest.raises(ValueError, match="positive"):
            run_benchmark(fake_adapter, runs=1, width=0, height=480)


# ── get_hardware_summary ───────────────────────────────────────────


class TestHardwareSummary:
    """Story 28: hardware info for reproducibility."""

    def test_always_has_device(self):
        from openeye_ai.utils.hardware import get_hardware_summary

        summary = get_hardware_summary()
        assert "device" in summary
        assert summary["device"] in ("CPU", "CUDA", "MPS")

    def test_always_has_cpu(self):
        from openeye_ai.utils.hardware import get_hardware_summary

        summary = get_hardware_summary()
        assert "cpu" in summary
        assert len(summary["cpu"]) > 0

    def test_always_has_platform(self):
        from openeye_ai.utils.hardware import get_hardware_summary

        summary = get_hardware_summary()
        assert "platform" in summary

    def test_cuda_shows_gpu(self, monkeypatch):
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = True
        mock_torch.backends.mps.is_available.return_value = False
        mock_torch.cuda.get_device_name.return_value = "NVIDIA A100"
        monkeypatch.setitem(sys.modules, "torch", mock_torch)

        from openeye_ai.utils.hardware import get_hardware_summary

        summary = get_hardware_summary()
        assert summary["device"] == "CUDA"
        assert summary["gpu"] == "NVIDIA A100"

    def test_mps_shows_gpu(self, monkeypatch):
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = False
        mock_torch.backends.mps.is_available.return_value = True
        monkeypatch.setitem(sys.modules, "torch", mock_torch)

        from openeye_ai.utils.hardware import get_hardware_summary

        summary = get_hardware_summary()
        assert summary["device"] == "MPS"
        assert "Metal" in summary["gpu"]


# ── bench CLI command ──────────────────────────────────────────────


def _make_registry() -> dict[str, dict[str, Any]]:
    return {
        "yolov8": {
            "name": "YOLOv8",
            "task": "detection",
            "adapter": "yolo",
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
    }


class _StubAdapter:
    def load(self, model_dir: Path) -> None:
        pass

    def predict(self, image: Any) -> dict:
        return {"objects": [], "inference_ms": 5.0}


def _patch_bench(monkeypatch, tmp_openeye_home, downloaded=True, variant_downloaded=False):
    """Patch bench command dependencies."""
    import openeye_ai.commands.inference.bench  # noqa: F811

    bench_mod = sys.modules["openeye_ai.commands.inference.bench"]
    registry = _make_registry()
    monkeypatch.setattr(bench_mod, "get_model_info", lambda m: registry[m])
    monkeypatch.setattr(bench_mod, "get_variant_info", lambda m, v: registry[m])
    monkeypatch.setattr(bench_mod, "is_downloaded", lambda m: downloaded)
    monkeypatch.setattr(bench_mod, "is_variant_downloaded", lambda m, v: variant_downloaded)
    monkeypatch.setattr(bench_mod, "get_adapter", lambda m, variant=None: _StubAdapter())
    monkeypatch.setattr(bench_mod, "MODELS_DIR", tmp_openeye_home / "models")


class TestBenchCLI:
    """Integration tests for `openeye bench` command output."""

    def test_default_bench_shows_stats_table(self, tmp_openeye_home, monkeypatch):
        """Story 23: mean/median/P95/FPS in a table."""
        _patch_bench(monkeypatch, tmp_openeye_home)
        result = runner.invoke(app, ["bench", "yolov8"])
        assert result.exit_code == 0
        assert "Mean" in result.output
        assert "Median" in result.output
        assert "P95" in result.output
        assert "FPS" in result.output
        assert "Std Dev" in result.output
        assert "Min" in result.output
        assert "Max" in result.output

    def test_custom_runs(self, tmp_openeye_home, monkeypatch):
        """Story 24: --runs flag for statistically significant results."""
        _patch_bench(monkeypatch, tmp_openeye_home)
        result = runner.invoke(app, ["bench", "yolov8", "--runs", "20"])
        assert result.exit_code == 0
        assert "20" in result.output  # runs count shown

    def test_variant_flag(self, tmp_openeye_home, monkeypatch):
        """Story 25: --variant quantized."""
        _patch_bench(monkeypatch, tmp_openeye_home, variant_downloaded=True)
        result = runner.invoke(app, ["bench", "yolov8", "--variant", "quantized"])
        assert result.exit_code == 0
        assert "quantized" in result.output

    def test_custom_resolution(self, tmp_openeye_home, monkeypatch):
        """Story 26: --width and --height."""
        _patch_bench(monkeypatch, tmp_openeye_home)
        result = runner.invoke(app, ["bench", "yolov8", "--width", "1920", "--height", "1080"])
        assert result.exit_code == 0
        assert "1920x1080" in result.output

    def test_hardware_shown(self, tmp_openeye_home, monkeypatch):
        """Story 28: hardware info in output."""
        _patch_bench(monkeypatch, tmp_openeye_home)
        result = runner.invoke(app, ["bench", "yolov8"])
        assert result.exit_code == 0
        assert "Device" in result.output
        assert "CPU" in result.output
        assert "Platform" in result.output

    def test_comparable_output_format(self, tmp_openeye_home, monkeypatch):
        """Story 27: comparable metrics across models."""
        _patch_bench(monkeypatch, tmp_openeye_home)

        result1 = runner.invoke(app, ["bench", "yolov8"])
        assert result1.exit_code == 0

        # Verify the output contains all standard metric labels
        for metric in ["Mean", "Median", "P95", "FPS", "Std Dev", "Min", "Max", "Runs", "Image Size"]:
            assert metric in result1.output

    def test_model_not_downloaded(self, tmp_openeye_home, monkeypatch):
        _patch_bench(monkeypatch, tmp_openeye_home, downloaded=False)
        result = runner.invoke(app, ["bench", "yolov8"])
        assert result.exit_code == 1
        assert "not downloaded" in result.output

    def test_invalid_params(self, tmp_openeye_home, monkeypatch):
        _patch_bench(monkeypatch, tmp_openeye_home)
        result = runner.invoke(app, ["bench", "yolov8", "--runs", "0"])
        assert result.exit_code == 1
