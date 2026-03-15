"""Schemas for benchmarks and validation tests (stories 187-188)."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from .enums import HardwareTarget

# ── Story 187: Cross-hardware benchmark matrix ───────────────────────

class HardwareBenchmarkEntry(BaseModel):
    """Benchmark results for a single model on a single hardware target."""

    hardware: HardwareTarget
    mean_latency_ms: float
    median_latency_ms: float
    p95_latency_ms: float
    throughput_fps: float
    memory_mb: float = 0.0
    power_watts: float | None = None

class BenchmarkMatrixResult(BaseModel):
    """Complete benchmark matrix for a model across hardware targets."""

    model_key: str
    model_version: str
    image_size: tuple[int, int] = (640, 480)
    runs_per_target: int = 100
    entries: list[HardwareBenchmarkEntry] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ── Story 188: Model validation tests ────────────────────────────────

class ValidationTest(BaseModel):
    """A model validation test that must pass before deployment."""

    id: str
    name: str
    model_key: str
    description: str = ""
    test_dataset: str = Field(description="Path to test dataset")
    conditions: list[str] = Field(
        description='Conditions like "accuracy > 0.95", "latency_ms < 50", "mAP > 0.80"'
    )
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ValidationConditionResult(BaseModel):
    """Result of evaluating a single validation condition."""

    condition: str
    actual_value: float
    passed: bool

class ValidationTestRun(BaseModel):
    """Result of running a validation test against a model version."""

    test_id: str
    model_key: str
    model_version: str
    passed: bool
    condition_results: list[ValidationConditionResult] = Field(default_factory=list)
    run_duration_seconds: float = 0.0
    run_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
