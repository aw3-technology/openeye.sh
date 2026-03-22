"""Tests for openeye_ai.mlops.lifecycle — gate evaluation & valid transitions."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest


class TestLifecycle:
    def test_valid_transitions(self):
        from openeye_ai.mlops.lifecycle import _VALID_TRANSITIONS
        from openeye_ai.mlops.schemas import ModelStage

        assert ModelStage.STAGING in _VALID_TRANSITIONS[ModelStage.DEV]
        assert ModelStage.PRODUCTION in _VALID_TRANSITIONS[ModelStage.STAGING]
        assert ModelStage.ARCHIVED in _VALID_TRANSITIONS[ModelStage.PRODUCTION]

    def test_find_gate(self):
        from openeye_ai.mlops.lifecycle import _find_gate
        from openeye_ai.mlops.schemas import ModelStage

        gate = _find_gate(ModelStage.DEV, ModelStage.STAGING)
        assert gate is not None
        assert gate.auto_approve_if == "accuracy > 0.90"

        gate2 = _find_gate(ModelStage.STAGING, ModelStage.PRODUCTION)
        assert gate2 is not None
        assert "ml-lead" in gate2.required_approvers

        assert _find_gate(ModelStage.DEV, ModelStage.PRODUCTION) is None

    def test_evaluate_gate_condition_simple(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(accuracy=0.95)

        assert _evaluate_gate_condition("accuracy > 0.90", version) is True
        assert _evaluate_gate_condition("accuracy > 0.99", version) is False

    def test_evaluate_gate_condition_compound(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(accuracy=0.95, loss=0.3)

        assert _evaluate_gate_condition("accuracy > 0.90 and loss < 0.5", version) is True
        assert _evaluate_gate_condition("accuracy > 0.90 and loss < 0.1", version) is False

    def test_evaluate_gate_condition_missing_metric(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics()

        assert _evaluate_gate_condition("nonexistent > 0.5", version) is False

    def test_evaluate_gate_condition_no_metrics(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition

        version = MagicMock()
        version.training_metrics = None

        assert _evaluate_gate_condition("accuracy > 0.5", version) is False

    def test_evaluate_gate_condition_operators(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(accuracy=0.95, f1=0.80)

        assert _evaluate_gate_condition("accuracy >= 0.95", version) is True
        assert _evaluate_gate_condition("accuracy == 0.95", version) is True
        assert _evaluate_gate_condition("accuracy != 0.90", version) is True
        assert _evaluate_gate_condition("accuracy < 0.95", version) is False
        assert _evaluate_gate_condition("accuracy <= 0.95", version) is True

    def test_evaluate_gate_condition_bad_expression(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(accuracy=0.95)

        assert _evaluate_gate_condition("not a valid condition", version) is False

    def test_evaluate_gate_condition_custom_metrics(self):
        from openeye_ai.mlops.lifecycle import _evaluate_gate_condition
        from openeye_ai.mlops.schemas import TrainingMetrics

        version = MagicMock()
        version.training_metrics = TrainingMetrics(custom={"auc": 0.98})

        assert _evaluate_gate_condition("auc > 0.95", version) is True

    def test_request_promotion_invalid_transition(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import request_promotion
        from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

        with pytest.raises(ValueError, match="Cannot promote"):
            request_promotion(
                PromotionRequest(
                    model_key="test-model", version="1.0.0",
                    target_stage=ModelStage.PRODUCTION, requester="tester",
                )
            )

    def test_request_promotion_valid(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import request_promotion
        from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

        record = request_promotion(
            PromotionRequest(
                model_key="test-model", version="1.0.0",
                target_stage=ModelStage.STAGING, requester="tester",
            )
        )
        assert record.from_stage == ModelStage.DEV
        assert record.to_stage == ModelStage.STAGING

    def test_list_promotions(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import list_promotions, request_promotion
        from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

        request_promotion(
            PromotionRequest(
                model_key="test-model", version="1.0.0",
                target_stage=ModelStage.STAGING, requester="tester",
            )
        )
        records = list_promotions()
        assert len(records) >= 1
        filtered = list_promotions(model_key="test-model")
        assert len(filtered) >= 1
        assert list_promotions(model_key="nonexistent") == []

    def test_approve_promotion(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import approve_promotion, request_promotion
        from openeye_ai.mlops.model_registry import get_version
        from openeye_ai.mlops.schemas import ApprovalStatus, ModelStage, PromotionRequest

        # DEV -> STAGING is auto-approved (accuracy gate with no required_approvers).
        # The seeded model has no training metrics, so auto-approve won't fire.
        # This means the promotion stays PENDING.
        record = request_promotion(
            PromotionRequest(
                model_key="test-model", version="1.0.0",
                target_stage=ModelStage.STAGING, requester="tester",
            )
        )
        # If it was auto-approved, we need to go further; otherwise approve manually
        if record.status == ApprovalStatus.PENDING:
            approved = approve_promotion("test-model", "1.0.0", approver="ml-lead")
            assert approved.status == ApprovalStatus.APPROVED
            assert approved.approver == "ml-lead"
            v = get_version("test-model", "1.0.0")
            assert v.stage == ModelStage.STAGING
        else:
            # Auto-approved, request staging -> production (requires manual approval)
            request_promotion(
                PromotionRequest(
                    model_key="test-model", version="1.0.0",
                    target_stage=ModelStage.PRODUCTION, requester="tester",
                )
            )
            approved = approve_promotion("test-model", "1.0.0", approver="ml-lead")
            assert approved.status == ApprovalStatus.APPROVED
            v = get_version("test-model", "1.0.0")
            assert v.stage == ModelStage.PRODUCTION

    def test_reject_promotion(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import reject_promotion, request_promotion
        from openeye_ai.mlops.schemas import ApprovalStatus, ModelStage, PromotionRequest

        # Request DEV -> STAGING; seeded model has no metrics so stays PENDING
        record = request_promotion(
            PromotionRequest(
                model_key="test-model", version="1.0.0",
                target_stage=ModelStage.STAGING, requester="tester",
            )
        )
        if record.status == ApprovalStatus.PENDING:
            rejected = reject_promotion("test-model", "1.0.0", approver="ml-lead", reason="not ready")
            assert rejected.status == ApprovalStatus.REJECTED
            assert rejected.reason == "not ready"
        else:
            # Auto-approved; request next stage and reject that
            request_promotion(
                PromotionRequest(
                    model_key="test-model", version="1.0.0",
                    target_stage=ModelStage.PRODUCTION, requester="tester",
                )
            )
            rejected = reject_promotion("test-model", "1.0.0", approver="ml-lead", reason="not ready")
            assert rejected.status == ApprovalStatus.REJECTED
            assert rejected.reason == "not ready"

    def test_approve_promotion_no_pending(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import approve_promotion

        with pytest.raises(KeyError, match="No pending promotion"):
            approve_promotion("test-model", "1.0.0", approver="ml-lead")

    def test_reject_promotion_no_pending(self, _seed_registry):
        from openeye_ai.mlops.lifecycle import reject_promotion

        with pytest.raises(KeyError, match="No pending promotion"):
            reject_promotion("test-model", "1.0.0", approver="ml-lead")

    def test_auto_approve_promotion_with_high_accuracy(self, _seed_registry):
        """DEV -> STAGING with accuracy > 0.90 should be auto-approved."""
        from openeye_ai.mlops.lifecycle import request_promotion
        from openeye_ai.mlops.model_registry import add_version, get_version
        from openeye_ai.mlops.schemas import (
            ApprovalStatus,
            ModelFormat,
            ModelStage,
            PromotionRequest,
        )

        # Add a version with high accuracy metrics
        import tempfile
        from pathlib import Path

        with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as f:
            f.write(b"\x00" * 512)
            tmp_file = f.name
        try:
            add_version(
                "test-model", file_path=tmp_file, version="2.0.0",
                format=ModelFormat.PYTORCH, training_metrics={"accuracy": 0.95},
            )
        finally:
            Path(tmp_file).unlink(missing_ok=True)

        record = request_promotion(
            PromotionRequest(
                model_key="test-model", version="2.0.0",
                target_stage=ModelStage.STAGING, requester="tester",
            )
        )
        assert record.status == ApprovalStatus.APPROVED
        assert record.approver == "auto"
        v = get_version("test-model", "2.0.0")
        assert v.stage == ModelStage.STAGING
