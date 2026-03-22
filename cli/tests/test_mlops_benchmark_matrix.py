"""Tests for openeye_ai.mlops.benchmark_matrix — hardware detection."""

from __future__ import annotations


class TestBenchmarkMatrix:
    def test_detect_available_hardware_includes_cpu(self):
        """CPU should always be in the detected hardware list."""
        from openeye_ai.mlops.benchmark_matrix import _detect_available_hardware
        from openeye_ai.mlops.schemas import HardwareTarget

        result = _detect_available_hardware()
        assert HardwareTarget.CPU in result

    def test_get_benchmark_results_empty(self):
        from openeye_ai.mlops.benchmark_matrix import get_benchmark_results

        assert get_benchmark_results("nonexistent") == []

    def test_get_benchmark_results_with_version_filter(self):
        """Filtering by model_version should narrow results."""
        from openeye_ai.mlops.benchmark_matrix import get_benchmark_results
        from openeye_ai.mlops.persistence import atomic_save_yaml

        from openeye_ai.mlops.schemas import BenchmarkMatrixResult, HardwareBenchmarkEntry, HardwareTarget

        # Manually persist two benchmark entries
        from openeye_ai.mlops.benchmark_matrix import _BENCHMARKS_PATH, _save_benchmarks

        entries = [
            BenchmarkMatrixResult(
                model_key="m", model_version="1.0",
                image_size=(640, 480), runs_per_target=10,
                entries=[HardwareBenchmarkEntry(
                    hardware=HardwareTarget.CPU,
                    mean_latency_ms=10.0, median_latency_ms=10.0,
                    p95_latency_ms=12.0, throughput_fps=100.0,
                )],
            ).model_dump(),
            BenchmarkMatrixResult(
                model_key="m", model_version="2.0",
                image_size=(640, 480), runs_per_target=10,
                entries=[HardwareBenchmarkEntry(
                    hardware=HardwareTarget.CPU,
                    mean_latency_ms=8.0, median_latency_ms=8.0,
                    p95_latency_ms=10.0, throughput_fps=125.0,
                )],
            ).model_dump(),
        ]
        _save_benchmarks(entries)

        all_results = get_benchmark_results("m")
        assert len(all_results) == 2
        filtered = get_benchmark_results("m", model_version="1.0")
        assert len(filtered) == 1
        assert filtered[0].model_version == "1.0"
