"""Model lifecycle — stage promotion with approval gates (story 183)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list

from .model_registry import _load_enterprise_registry, _save_enterprise_registry, get_version
from .schemas import (
    ApprovalGate,
    ApprovalStatus,
    ModelStage,
    PromotionRecord,
    PromotionRequest,
)

_PROMOTIONS_PATH = OPENEYE_HOME / "promotions.yaml"

# Default approval gates
DEFAULT_GATES: list[ApprovalGate] = [
    ApprovalGate(
        from_stage=ModelStage.DEV,
        to_stage=ModelStage.STAGING,
        required_approvers=[],
        auto_approve_if="accuracy > 0.90",
    ),
    ApprovalGate(
        from_stage=ModelStage.STAGING,
        to_stage=ModelStage.PRODUCTION,
        required_approvers=["ml-lead"],
    ),
]


def _load_promotions() -> list[dict]:
    return safe_load_yaml_list(_PROMOTIONS_PATH)


def _save_promotions(records: list[dict]) -> None:
    atomic_save_yaml(_PROMOTIONS_PATH, records)


_VALID_TRANSITIONS = {
    ModelStage.DEV: [ModelStage.STAGING],
    ModelStage.STAGING: [ModelStage.PRODUCTION],
    ModelStage.PRODUCTION: [ModelStage.ARCHIVED],
}


def request_promotion(request: PromotionRequest) -> PromotionRecord:
    """Request to promote a model version to a new stage.

    Validates the stage transition is valid, then creates a pending promotion record.
    If the gate has auto_approve_if and the condition is met, auto-approves.
    """
    version = get_version(request.model_key, request.version)
    current_stage = version.stage

    if request.target_stage not in _VALID_TRANSITIONS.get(current_stage, []):
        valid = _VALID_TRANSITIONS.get(current_stage, [])
        raise ValueError(
            f"Cannot promote from {current_stage.value} to {request.target_stage.value}. "
            f"Valid targets: {[s.value for s in valid]}"
        )

    record = PromotionRecord(
        model_key=request.model_key,
        version=request.version,
        from_stage=current_stage,
        to_stage=request.target_stage,
        requester=request.requester,
        reason=request.reason,
    )

    # Check for auto-approval gate
    gate = _find_gate(current_stage, request.target_stage)
    if gate and gate.auto_approve_if and not gate.required_approvers:
        if _evaluate_gate_condition(gate.auto_approve_if, version):
            record.status = ApprovalStatus.APPROVED
            record.approver = "auto"
            record.reviewed_at = datetime.now(timezone.utc).isoformat()
            _apply_promotion(record)

    records = _load_promotions()
    records.append(record.model_dump())
    _save_promotions(records)

    return record


def approve_promotion(
    model_key: str, version: str, approver: str
) -> PromotionRecord:
    """Approve a pending promotion request."""
    records = _load_promotions()

    for i, raw in enumerate(records):
        rec = PromotionRecord(**raw)
        if (
            rec.model_key == model_key
            and rec.version == version
            and rec.status == ApprovalStatus.PENDING
        ):
            rec.status = ApprovalStatus.APPROVED
            rec.approver = approver
            rec.reviewed_at = datetime.now(timezone.utc).isoformat()
            _apply_promotion(rec)
            records[i] = rec.model_dump()
            _save_promotions(records)
            return rec

    raise KeyError(f"No pending promotion for {model_key} v{version}")


def reject_promotion(
    model_key: str, version: str, approver: str, reason: str = ""
) -> PromotionRecord:
    """Reject a pending promotion request."""
    records = _load_promotions()

    for i, raw in enumerate(records):
        rec = PromotionRecord(**raw)
        if (
            rec.model_key == model_key
            and rec.version == version
            and rec.status == ApprovalStatus.PENDING
        ):
            rec.status = ApprovalStatus.REJECTED
            rec.approver = approver
            rec.reason = reason or rec.reason
            rec.reviewed_at = datetime.now(timezone.utc).isoformat()
            records[i] = rec.model_dump()
            _save_promotions(records)
            return rec

    raise KeyError(f"No pending promotion for {model_key} v{version}")


def list_promotions(model_key: Optional[str] = None) -> list[PromotionRecord]:
    """List promotion records, optionally filtered by model key."""
    records = _load_promotions()
    result = [PromotionRecord(**r) for r in records]
    if model_key:
        result = [r for r in result if r.model_key == model_key]
    return result


def _apply_promotion(record: PromotionRecord) -> None:
    """Update the model version's stage in the registry.

    Raises KeyError if the model or version is not found.
    """
    data = _load_enterprise_registry()
    model = data["models"].get(record.model_key)
    if model is None:
        raise KeyError(f"Model '{record.model_key}' not found in registry during promotion.")

    versions = model.get("versions", [])
    for v in versions:
        if v["version"] == record.version:
            v["stage"] = record.to_stage.value
            _save_enterprise_registry(data)
            return

    raise KeyError(f"Version '{record.version}' not found for model '{record.model_key}' during promotion.")


def _find_gate(from_stage: ModelStage, to_stage: ModelStage) -> Optional[ApprovalGate]:
    for gate in DEFAULT_GATES:
        if gate.from_stage == from_stage and gate.to_stage == to_stage:
            return gate
    return None


import re

# Pattern: "metric_name operator threshold"
_GATE_CONDITION_RE = re.compile(r"^(\w+)\s*(>=|<=|>|<|==|!=)\s*([\d.]+)$")
_GATE_OPS = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
}


def _evaluate_gate_condition(condition: str, version) -> bool:
    """Evaluate gate conditions against model metrics.

    Supports expressions like 'accuracy > 0.95' or compound conditions
    joined by 'and' (e.g. 'accuracy > 0.95 and loss < 0.5').
    Uses safe regex parsing — no eval().
    """
    metrics = version.training_metrics
    if metrics is None:
        return False

    namespace = {
        "accuracy": metrics.accuracy if metrics.accuracy is not None else 0.0,
        "precision": metrics.precision if metrics.precision is not None else 0.0,
        "recall": metrics.recall if metrics.recall is not None else 0.0,
        "f1": metrics.f1 if metrics.f1 is not None else 0.0,
        "mAP": metrics.mAP if metrics.mAP is not None else 0.0,
        "loss": metrics.loss if metrics.loss is not None else float("inf"),
    }
    namespace.update(metrics.custom)

    # Split on 'and' for compound conditions
    parts = [p.strip() for p in condition.split(" and ")]
    for part in parts:
        match = _GATE_CONDITION_RE.match(part)
        if not match:
            return False
        metric_name, operator, threshold_str = match.groups()
        actual = namespace.get(metric_name)
        if actual is None:
            return False
        try:
            threshold = float(threshold_str)
        except ValueError:
            return False
        if not _GATE_OPS[operator](actual, threshold):
            return False

    return True
