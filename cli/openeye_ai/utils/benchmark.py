"""Model benchmarking utilities."""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass, field
from typing import Any

from openeye_ai.adapters.base import ModelAdapter


@dataclass
class BenchmarkResult:
    """Results from a benchmark run."""

    model: str
    variant: str | None
    runs: int
    warmup: int
    image_size: tuple[int, int]
    times_ms: list[float] = field(default_factory=list)
    hardware: dict[str, str] = field(default_factory=dict)

    @property
    def mean_ms(self) -> float:
        return statistics.mean(self.times_ms) if self.times_ms else 0.0

    @property
    def median_ms(self) -> float:
        return statistics.median(self.times_ms) if self.times_ms else 0.0

    @property
    def std_ms(self) -> float:
        if len(self.times_ms) < 2:
            return 0.0
        return statistics.stdev(self.times_ms)

    @property
    def min_ms(self) -> float:
        return min(self.times_ms) if self.times_ms else 0.0

    @property
    def max_ms(self) -> float:
        return max(self.times_ms) if self.times_ms else 0.0

    @property
    def p95_ms(self) -> float:
        if not self.times_ms:
            return 0.0
        sorted_times = sorted(self.times_ms)
        idx = int(len(sorted_times) * 0.95)
        return sorted_times[min(idx, len(sorted_times) - 1)]

    @property
    def fps(self) -> float:
        return 1000.0 / self.mean_ms if self.mean_ms > 0 else 0.0


def run_benchmark(
    adapter: ModelAdapter,
    *,
    model_name: str = "",
    variant: str | None = None,
    warmup: int = 3,
    runs: int = 10,
    width: int = 640,
    height: int = 480,
) -> BenchmarkResult:
    """Run a benchmark on a loaded adapter.

    Creates a synthetic image and runs inference multiple times.
    """
    if runs <= 0:
        raise ValueError("runs must be a positive integer")
    if width <= 0 or height <= 0:
        raise ValueError("width and height must be positive integers")

    from openeye_ai.utils.hardware import get_hardware_summary

    import numpy as np
    from PIL import Image

    # Create a random test image
    arr = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
    test_image = Image.fromarray(arr)

    # Warmup runs
    for _ in range(warmup):
        adapter.predict(test_image)

    # Timed runs
    times: list[float] = []
    for _ in range(runs):
        start = time.perf_counter()
        adapter.predict(test_image)
        elapsed = (time.perf_counter() - start) * 1000
        times.append(elapsed)

    return BenchmarkResult(
        model=model_name,
        variant=variant,
        runs=runs,
        warmup=warmup,
        image_size=(width, height),
        times_ms=times,
        hardware=get_hardware_summary(),
    )
