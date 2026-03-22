"""Tests for openeye_ai.mlops.ab_testing — winner determination."""

from __future__ import annotations

import pytest


class TestABTesting:
    def test_determine_winner_accuracy(self):
        from openeye_ai.mlops.ab_testing import _determine_winner
        from openeye_ai.mlops.schemas import ABTestConfig, ABTestMetrics, ABTestResult

        test = ABTestResult(
            id="ab-test1",
            config=ABTestConfig(name="t", model_key="m", version_a="v1", version_b="v2"),
            metrics_a=ABTestMetrics(version="v1", mean_accuracy=0.90),
            metrics_b=ABTestMetrics(version="v2", mean_accuracy=0.95),
        )
        _determine_winner(test)
        assert test.winner == "v2"

    def test_determine_winner_latency_tiebreak(self):
        from openeye_ai.mlops.ab_testing import _determine_winner
        from openeye_ai.mlops.schemas import ABTestConfig, ABTestMetrics, ABTestResult

        test = ABTestResult(
            id="ab-test2",
            config=ABTestConfig(name="t", model_key="m", version_a="v1", version_b="v2"),
            metrics_a=ABTestMetrics(version="v1", mean_accuracy=0.90, mean_latency_ms=10),
            metrics_b=ABTestMetrics(version="v2", mean_accuracy=0.90, mean_latency_ms=20),
        )
        _determine_winner(test)
        assert test.winner == "v1"  # lower latency wins

    def test_determine_winner_equal_defaults_to_a(self):
        from openeye_ai.mlops.ab_testing import _determine_winner
        from openeye_ai.mlops.schemas import ABTestConfig, ABTestMetrics, ABTestResult

        test = ABTestResult(
            id="ab-test3",
            config=ABTestConfig(name="t", model_key="m", version_a="v1", version_b="v2"),
            metrics_a=ABTestMetrics(version="v1"),
            metrics_b=ABTestMetrics(version="v2"),
        )
        _determine_winner(test)
        assert test.winner == "v1"

    def test_create_and_list_ab_tests(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, list_ab_tests
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="exp1", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)
        assert test.id.startswith("ab-")

        tests = list_ab_tests()
        assert len(tests) == 1
        assert list_ab_tests(model_key="m") == tests
        assert list_ab_tests(model_key="other") == []

    def test_record_result_updates_metrics(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, record_result
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="exp2", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)

        updated = record_result(test.id, "v1", latency_ms=10.0, accuracy=0.9)
        assert updated.metrics_a.samples == 1
        assert updated.metrics_a.mean_latency_ms == 10.0
        assert updated.metrics_a.mean_accuracy == 0.9

    def test_record_result_unknown_version(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, record_result
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="exp3", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)

        with pytest.raises(ValueError, match="not part of test"):
            record_result(test.id, "v99", latency_ms=10.0)

    def test_get_ab_test_not_found(self):
        from openeye_ai.mlops.ab_testing import get_ab_test

        with pytest.raises(KeyError, match="not found"):
            get_ab_test("ab-nonexistent")

    def test_get_ab_test_success(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, get_ab_test
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="get-test", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)
        fetched = get_ab_test(test.id)
        assert fetched.id == test.id
        assert fetched.config.name == "get-test"

    def test_complete_ab_test(self):
        from openeye_ai.mlops.ab_testing import complete_ab_test, create_ab_test
        from openeye_ai.mlops.schemas import ABTestConfig, ABTestStatus

        config = ABTestConfig(name="complete-test", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)
        completed = complete_ab_test(test.id)
        assert completed.status == ABTestStatus.COMPLETED
        assert completed.completed_at is not None
        assert completed.winner is not None

    def test_complete_ab_test_not_found(self):
        from openeye_ai.mlops.ab_testing import complete_ab_test

        with pytest.raises(KeyError, match="not found"):
            complete_ab_test("ab-nonexistent")

    def test_route_request(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, route_request
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="route-test", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)
        result = route_request(test.id)
        assert result in ("v1", "v2")

    def test_route_request_non_running(self):
        from openeye_ai.mlops.ab_testing import complete_ab_test, create_ab_test, route_request
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="route-done", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)
        complete_ab_test(test.id)
        with pytest.raises(RuntimeError, match="not running"):
            route_request(test.id)

    def test_record_result_with_error(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, record_result
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="err-test", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)
        updated = record_result(test.id, "v1", latency_ms=10.0, error=True)
        assert updated.metrics_a.error_rate == pytest.approx(1.0)

    def test_record_result_with_custom_metrics(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, record_result
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="custom-test", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)
        updated = record_result(test.id, "v1", latency_ms=10.0, custom_metrics={"iou": 0.85})
        assert updated.metrics_a.custom_metrics["iou"] == pytest.approx(0.85)

    def test_record_result_auto_completion_via_max_samples(self):
        from openeye_ai.mlops.ab_testing import create_ab_test, record_result
        from openeye_ai.mlops.schemas import ABTestConfig, ABTestStatus

        config = ABTestConfig(
            name="auto-complete", model_key="m", version_a="v1", version_b="v2",
            max_samples=2,
        )
        test = create_ab_test(config)
        record_result(test.id, "v1", latency_ms=10.0, accuracy=0.9)
        updated = record_result(test.id, "v2", latency_ms=15.0, accuracy=0.8)
        assert updated.status == ABTestStatus.COMPLETED
        assert updated.winner is not None

    def test_record_result_test_not_found(self):
        from openeye_ai.mlops.ab_testing import record_result

        with pytest.raises(KeyError, match="not found"):
            record_result("ab-nonexistent", "v1", latency_ms=10.0)

    def test_record_result_running_average(self):
        """Multiple records should compute correct running averages."""
        from openeye_ai.mlops.ab_testing import create_ab_test, record_result
        from openeye_ai.mlops.schemas import ABTestConfig

        config = ABTestConfig(name="avg-test", model_key="m", version_a="v1", version_b="v2")
        test = create_ab_test(config)
        record_result(test.id, "v1", latency_ms=10.0, accuracy=0.8)
        updated = record_result(test.id, "v1", latency_ms=20.0, accuracy=1.0)
        assert updated.metrics_a.samples == 2
        assert updated.metrics_a.mean_latency_ms == pytest.approx(15.0)
        assert updated.metrics_a.mean_accuracy == pytest.approx(0.9)
