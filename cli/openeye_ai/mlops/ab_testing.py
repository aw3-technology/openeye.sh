"""A/B testing engine for model versions (story 184).

Allows running two model versions in production and comparing
accuracy/latency metrics side by side.
"""

from __future__ import annotations

import random
import statistics
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import ABTestConfig, ABTestMetrics, ABTestResult, ABTestStatus

_AB_TESTS_PATH = OPENEYE_HOME / "ab_tests.yaml"


def _load_tests() -> list[dict]:
    return safe_load_yaml_list(_AB_TESTS_PATH)


def _save_tests(tests: list[dict]) -> None:
    atomic_save_yaml(_AB_TESTS_PATH, tests)


def create_ab_test(config: ABTestConfig) -> ABTestResult:
    """Create and start a new A/B test."""
    test = ABTestResult(
        id=f"ab-{uuid.uuid4().hex[:8]}",
        config=config,
        status=ABTestStatus.RUNNING,
        metrics_a=ABTestMetrics(version=config.version_a),
        metrics_b=ABTestMetrics(version=config.version_b),
    )

    tests = _load_tests()
    tests.append(test.model_dump())
    _save_tests(tests)
    return test


def get_ab_test(test_id: str) -> ABTestResult:
    """Get an A/B test by ID."""
    tests = _load_tests()
    for raw in tests:
        if raw["id"] == test_id:
            return ABTestResult(**raw)
    raise KeyError(f"A/B test '{test_id}' not found.")


def list_ab_tests(model_key: Optional[str] = None) -> list[ABTestResult]:
    """List all A/B tests, optionally filtered by model."""
    tests = _load_tests()
    results = [ABTestResult(**t) for t in tests]
    if model_key:
        results = [r for r in results if r.config.model_key == model_key]
    return results


def route_request(test_id: str) -> str:
    """Route an inference request to version A or B based on traffic split.

    Returns the version string to use.
    """
    test = get_ab_test(test_id)
    if test.status != ABTestStatus.RUNNING:
        raise RuntimeError(f"A/B test '{test_id}' is not running (status: {test.status.value})")

    if random.random() < test.config.traffic_split:
        return test.config.version_b
    return test.config.version_a


def record_result(
    test_id: str,
    version: str,
    latency_ms: float,
    accuracy: Optional[float] = None,
    error: bool = False,
    custom_metrics: Optional[dict[str, float]] = None,
) -> ABTestResult:
    """Record a single inference result for an A/B test."""
    tests = _load_tests()

    for i, raw in enumerate(tests):
        if raw["id"] != test_id:
            continue

        test = ABTestResult(**raw)
        if test.status != ABTestStatus.RUNNING:
            return test

        if version == test.config.version_a:
            metrics = test.metrics_a
        elif version == test.config.version_b:
            metrics = test.metrics_b
        else:
            raise ValueError(f"Version '{version}' not part of test '{test_id}'")

        # Update running averages
        n = metrics.samples
        metrics.samples = n + 1
        metrics.mean_latency_ms = (metrics.mean_latency_ms * n + latency_ms) / (n + 1)
        if accuracy is not None:
            metrics.mean_accuracy = (metrics.mean_accuracy * n + accuracy) / (n + 1)
        if error:
            metrics.error_rate = (metrics.error_rate * n + 1.0) / (n + 1)
        else:
            metrics.error_rate = (metrics.error_rate * n) / (n + 1)

        if custom_metrics:
            for k, v in custom_metrics.items():
                old = metrics.custom_metrics.get(k, 0.0)
                metrics.custom_metrics[k] = (old * n + v) / (n + 1)

        # Check completion conditions
        total = test.metrics_a.samples + test.metrics_b.samples
        completed = False
        if test.config.max_samples and total >= test.config.max_samples:
            completed = True
        if test.config.duration_hours and test.started_at:
            elapsed_hours = (
                datetime.now(timezone.utc) - datetime.fromisoformat(test.started_at)
            ).total_seconds() / 3600
            if elapsed_hours >= test.config.duration_hours:
                completed = True
        if completed:
            test.status = ABTestStatus.COMPLETED
            test.completed_at = datetime.now(timezone.utc).isoformat()
            _determine_winner(test)

        tests[i] = test.model_dump()
        _save_tests(tests)
        return test

    raise KeyError(f"A/B test '{test_id}' not found.")


def complete_ab_test(test_id: str) -> ABTestResult:
    """Manually complete an A/B test and determine the winner."""
    tests = _load_tests()
    for i, raw in enumerate(tests):
        if raw["id"] == test_id:
            test = ABTestResult(**raw)
            test.status = ABTestStatus.COMPLETED
            test.completed_at = datetime.now(timezone.utc).isoformat()
            _determine_winner(test)
            tests[i] = test.model_dump()
            _save_tests(tests)
            return test
    raise KeyError(f"A/B test '{test_id}' not found.")


def _determine_winner(test: ABTestResult) -> None:
    """Determine the winner based on accuracy (primary) and latency (secondary)."""
    a, b = test.metrics_a, test.metrics_b

    if a.mean_accuracy > b.mean_accuracy:
        test.winner = a.version
    elif b.mean_accuracy > a.mean_accuracy:
        test.winner = b.version
    elif a.mean_latency_ms < b.mean_latency_ms:
        test.winner = a.version
    elif b.mean_latency_ms < a.mean_latency_ms:
        test.winner = b.version
    else:
        test.winner = a.version  # default to control
