"""Tests for openeye_ai.mlops.validation — condition evaluation."""

from __future__ import annotations

import pytest


class TestValidation:
    def test_evaluate_condition_pass(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        result = _evaluate_condition("accuracy > 0.90", {"accuracy": 0.95})
        assert result.passed is True
        assert result.actual_value == 0.95

    def test_evaluate_condition_fail(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        result = _evaluate_condition("accuracy > 0.90", {"accuracy": 0.80})
        assert result.passed is False

    def test_evaluate_condition_missing_metric(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        result = _evaluate_condition("latency_ms < 50", {})
        # Missing metric defaults to 0.0
        assert result.actual_value == 0.0
        assert result.passed is True  # 0.0 < 50

    def test_evaluate_condition_all_operators(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        metrics = {"x": 5.0}
        assert _evaluate_condition("x > 4", metrics).passed is True
        assert _evaluate_condition("x >= 5", metrics).passed is True
        assert _evaluate_condition("x < 6", metrics).passed is True
        assert _evaluate_condition("x <= 5", metrics).passed is True
        assert _evaluate_condition("x == 5", metrics).passed is True
        assert _evaluate_condition("x != 3", metrics).passed is True

    def test_evaluate_condition_bad_format(self):
        from openeye_ai.mlops.validation import _evaluate_condition

        result = _evaluate_condition("not valid", {"x": 1.0})
        assert result.passed is False

    def test_create_validation_test_bad_condition(self):
        from openeye_ai.mlops.validation import create_validation_test

        with pytest.raises(ValueError, match="Invalid condition"):
            create_validation_test(
                name="bad", model_key="m", test_dataset="/tmp/d",
                conditions=["not a real condition"],
            )

    def test_create_and_list_validation_tests(self):
        from openeye_ai.mlops.validation import create_validation_test, list_validation_tests

        create_validation_test(
            name="smoke", model_key="mymodel", test_dataset="/data",
            conditions=["accuracy > 0.8", "latency_ms < 100"],
        )
        tests = list_validation_tests()
        assert len(tests) == 1
        assert tests[0].name == "smoke"

        filtered = list_validation_tests(model_key="mymodel")
        assert len(filtered) == 1
        assert list_validation_tests(model_key="other") == []

    def test_get_validation_test_not_found(self):
        from openeye_ai.mlops.validation import get_validation_test

        with pytest.raises(KeyError, match="not found"):
            get_validation_test("vt-nonexistent")

    def test_get_validation_test_success(self):
        from openeye_ai.mlops.validation import create_validation_test, get_validation_test

        test = create_validation_test(
            name="get-test", model_key="m", test_dataset="/data",
            conditions=["accuracy > 0.8"],
        )
        fetched = get_validation_test(test.id)
        assert fetched.name == "get-test"
        assert fetched.conditions == ["accuracy > 0.8"]
