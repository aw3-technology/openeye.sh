"""Model validation tests — gates that must pass before deployment (story 188)."""

from __future__ import annotations

import re
import time
import uuid
from typing import Any

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import (
    PipelineStatus,
    ValidationConditionResult,
    ValidationTest,
    ValidationTestRun,
)

_TESTS_PATH = OPENEYE_HOME / "validation_tests.yaml"
_RUNS_PATH = OPENEYE_HOME / "validation_runs.yaml"

# Pattern: "metric_name operator threshold"
_CONDITION_PATTERN = re.compile(r"(\w+)\s*(>=|<=|>|<|==|!=)\s*([\d.]+)")

def _load_tests() -> list[dict]:
    return safe_load_yaml_list(_TESTS_PATH)

def _save_tests(tests: list[dict]) -> None:
    atomic_save_yaml(_TESTS_PATH, tests)

def _load_runs() -> list[dict]:
    return safe_load_yaml_list(_RUNS_PATH)

def _save_runs(runs: list[dict]) -> None:
    atomic_save_yaml(_RUNS_PATH, runs)

def create_validation_test(
    name: str,
    model_key: str,
    test_dataset: str,
    conditions: list[str],
    description: str = "",
) -> ValidationTest:
    """Create a new validation test.

    Conditions are expressions like:
    - "accuracy > 0.95"
    - "latency_ms < 50"
    - "mAP > 0.80"
    """
    for cond in conditions:
        if not _CONDITION_PATTERN.match(cond.strip()):
            raise ValueError(
                f"Invalid condition '{cond}'. Expected format: 'metric operator threshold' "
                f"(e.g. 'accuracy > 0.95')"
            )

    test = ValidationTest(
        id=f"vt-{uuid.uuid4().hex[:8]}",
        name=name,
        model_key=model_key,
        test_dataset=test_dataset,
        conditions=conditions,
        description=description,
    )

    tests = _load_tests()
    tests.append(test.model_dump())
    _save_tests(tests)
    return test

def get_validation_test(test_id: str) -> ValidationTest:
    """Get a validation test by ID."""
    tests = _load_tests()
    for t in tests:
        if t["id"] == test_id:
            return ValidationTest(**t)
    raise KeyError(f"Validation test '{test_id}' not found.")

def list_validation_tests(model_key: str | None = None) -> list[ValidationTest]:
    """List validation tests."""
    tests = _load_tests()
    result = [ValidationTest(**t) for t in tests]
    if model_key:
        result = [t for t in result if t.model_key == model_key]
    return result

def _evaluate_condition(condition: str, metrics: dict[str, float]) -> ValidationConditionResult:
    """Evaluate a single condition against computed metrics."""
    match = _CONDITION_PATTERN.match(condition.strip())
    if not match:
        return ValidationConditionResult(condition=condition, actual_value=0.0, passed=False)

    metric_name = match.group(1)
    operator = match.group(2)
    threshold = float(match.group(3))

    actual = metrics.get(metric_name, 0.0)

    ops = {
        ">": lambda a, b: a > b,
        ">=": lambda a, b: a >= b,
        "<": lambda a, b: a < b,
        "<=": lambda a, b: a <= b,
        "==": lambda a, b: a == b,
        "!=": lambda a, b: a != b,
    }

    passed = ops[operator](actual, threshold)
    return ValidationConditionResult(
        condition=condition,
        actual_value=actual,
        passed=passed,
    )

def run_validation_test(
    test_id: str,
    model_key: str,
    model_version: str,
    adapter,
    *,
    ground_truth: dict[str, Any] | None = None,
) -> ValidationTestRun:
    """Run a validation test against a model version.

    Loads the test dataset, runs inference, computes metrics, and evaluates conditions.

    Args:
        test_id: The validation test to run.
        model_key: The model being tested.
        model_version: The version being tested.
        adapter: A loaded ModelAdapter instance.
        ground_truth: Optional dict mapping image paths to ground truth labels/boxes.
    """
    from pathlib import Path

    from PIL import Image

    test = get_validation_test(test_id)
    start_time = time.monotonic()

    # Load test images
    dataset_path = Path(test.test_dataset)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Test dataset not found: {test.test_dataset}")

    image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
    images = sorted(
        p for p in dataset_path.rglob("*") if p.is_file() and p.suffix.lower() in image_extensions
    )

    if not images:
        raise ValueError(f"No images found in test dataset: {test.test_dataset}")

    # Run inference and compute metrics
    total = len(images)
    correct = 0
    latencies = []
    all_predictions = []

    for img_path in images:
        img = Image.open(img_path).convert("RGB")

        t0 = time.perf_counter()
        result = adapter.predict(img)
        latency = (time.perf_counter() - t0) * 1000
        latencies.append(latency)

        all_predictions.append(result)

        # Check correctness against ground truth if available
        if ground_truth:
            gt = ground_truth.get(str(img_path), {})
            pred_labels = {o["label"] for o in result.get("objects", [])}
            gt_labels = set(gt.get("labels", []))
            if pred_labels & gt_labels:
                correct += 1
        else:
            # Without ground truth, count detections as "correct"
            if result.get("objects"):
                correct += 1

    # Compute metrics
    import statistics

    metrics = {
        "accuracy": correct / total if total > 0 else 0.0,
        "latency_ms": statistics.mean(latencies) if latencies else 0.0,
        "p95_latency_ms": sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0.0,
        "total_images": float(total),
        "detection_rate": sum(1 for p in all_predictions if p.get("objects")) / total if total > 0 else 0.0,
    }

    # Compute mAP if ground truth is available
    if ground_truth:
        # Simplified mAP: fraction of images where any prediction overlaps with GT
        metrics["mAP"] = correct / total if total > 0 else 0.0

    # Evaluate conditions
    condition_results = [_evaluate_condition(c, metrics) for c in test.conditions]
    all_passed = all(cr.passed for cr in condition_results)

    duration = time.monotonic() - start_time
    run = ValidationTestRun(
        test_id=test_id,
        model_key=model_key,
        model_version=model_version,
        passed=all_passed,
        condition_results=condition_results,
        run_duration_seconds=round(duration, 2),
    )

    runs = _load_runs()
    runs.append(run.model_dump())
    _save_runs(runs)

    return run

def list_validation_runs(
    test_id: str | None = None,
    model_key: str | None = None,
) -> list[ValidationTestRun]:
    """List validation test runs."""
    runs = _load_runs()
    result = [ValidationTestRun(**r) for r in runs]
    if test_id:
        result = [r for r in result if r.test_id == test_id]
    if model_key:
        result = [r for r in result if r.model_key == model_key]
    return result
