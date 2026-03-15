"""Cross-hardware benchmark matrix (story 187).

Compare model performance across hardware targets (Jetson vs A100 vs CPU).
"""

from __future__ import annotations

import time
from typing import Any, Optional

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import BenchmarkMatrixResult, HardwareBenchmarkEntry, HardwareTarget

_BENCHMARKS_PATH = OPENEYE_HOME / "benchmark_results.yaml"


def _load_benchmarks() -> list[dict]:
    return safe_load_yaml_list(_BENCHMARKS_PATH)


def _save_benchmarks(benchmarks: list[dict]) -> None:
    atomic_save_yaml(_BENCHMARKS_PATH, benchmarks)


def _detect_available_hardware() -> list[HardwareTarget]:
    """Detect which hardware targets are available on this machine."""
    available = [HardwareTarget.CPU]

    try:
        import torch

        if torch.cuda.is_available():
            device_name = torch.cuda.get_device_name(0).lower()
            if "a100" in device_name:
                available.append(HardwareTarget.A100)
            elif "t4" in device_name:
                available.append(HardwareTarget.T4)
            else:
                # Generic CUDA GPU — map to A100 slot as closest approximation
                available.append(HardwareTarget.A100)
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            available.append(HardwareTarget.MPS)
    except ImportError:
        pass

    try:
        import tensorrt  # noqa: F401

        available.append(HardwareTarget.TENSORRT)
    except ImportError:
        pass

    return available


def run_benchmark_on_hardware(
    adapter,
    hardware: HardwareTarget,
    *,
    runs: int = 100,
    warmup: int = 5,
    width: int = 640,
    height: int = 480,
) -> HardwareBenchmarkEntry:
    """Run benchmark on a specific hardware target."""
    import statistics

    import numpy as np
    from PIL import Image

    arr = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
    test_image = Image.fromarray(arr)

    # Warmup
    for _ in range(warmup):
        adapter.predict(test_image)

    # Timed runs
    times: list[float] = []
    for _ in range(runs):
        start = time.perf_counter()
        adapter.predict(test_image)
        elapsed = (time.perf_counter() - start) * 1000
        times.append(elapsed)

    sorted_times = sorted(times)
    p95_idx = min(int(len(sorted_times) * 0.95), len(sorted_times) - 1)
    mean = statistics.mean(times)

    # Estimate memory usage
    memory_mb = 0.0
    try:
        import torch

        if torch.cuda.is_available():
            memory_mb = torch.cuda.max_memory_allocated() / (1024 * 1024)
    except (ImportError, RuntimeError):
        pass

    return HardwareBenchmarkEntry(
        hardware=hardware,
        mean_latency_ms=round(mean, 2),
        median_latency_ms=round(statistics.median(times), 2),
        p95_latency_ms=round(sorted_times[p95_idx], 2),
        throughput_fps=round(1000.0 / mean if mean > 0 else 0, 1),
        memory_mb=round(memory_mb, 1),
    )


def run_benchmark_matrix(
    adapter,
    model_key: str,
    model_version: str,
    *,
    targets: Optional[list[HardwareTarget]] = None,
    runs_per_target: int = 100,
    width: int = 640,
    height: int = 480,
) -> BenchmarkMatrixResult:
    """Run benchmark across all available hardware targets.

    If targets is None, auto-detects available hardware.
    """
    if targets is None:
        targets = _detect_available_hardware()

    entries = []
    for hw in targets:
        entry = run_benchmark_on_hardware(
            adapter,
            hw,
            runs=runs_per_target,
            width=width,
            height=height,
        )
        entries.append(entry)

    result = BenchmarkMatrixResult(
        model_key=model_key,
        model_version=model_version,
        image_size=(width, height),
        runs_per_target=runs_per_target,
        entries=entries,
    )

    # Persist
    benchmarks = _load_benchmarks()
    benchmarks.append(result.model_dump())
    _save_benchmarks(benchmarks)

    return result


def get_benchmark_results(
    model_key: str, model_version: Optional[str] = None
) -> list[BenchmarkMatrixResult]:
    """Get stored benchmark results for a model."""
    benchmarks = _load_benchmarks()
    results = [BenchmarkMatrixResult(**b) for b in benchmarks]
    results = [r for r in results if r.model_key == model_key]
    if model_version:
        results = [r for r in results if r.model_version == model_version]
    return results
