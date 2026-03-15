"""Inference failure annotation and feedback loop (story 192).

Annotate inference failures and feed corrections back into the training pipeline.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import (
    AnnotationLabel,
    FeedbackBatch,
    InferenceFailureAnnotation,
    PipelineStatus,
)

_ANNOTATIONS_PATH = OPENEYE_HOME / "annotations.yaml"
_BATCHES_PATH = OPENEYE_HOME / "feedback_batches.yaml"


def _load_annotations() -> list[dict]:
    return safe_load_yaml_list(_ANNOTATIONS_PATH)


def _save_annotations(annotations: list[dict]) -> None:
    atomic_save_yaml(_ANNOTATIONS_PATH, annotations)


def _load_batches() -> list[dict]:
    return safe_load_yaml_list(_BATCHES_PATH)


def _save_batches(batches: list[dict]) -> None:
    atomic_save_yaml(_BATCHES_PATH, batches)


def annotate_failure(
    model_key: str,
    model_version: str,
    image_source: str,
    correct_label: str,
    annotation_label: AnnotationLabel,
    *,
    predicted_label: Optional[str] = None,
    predicted_confidence: Optional[float] = None,
    correct_bbox: Optional[dict[str, float]] = None,
    annotator: str = "",
    notes: str = "",
) -> InferenceFailureAnnotation:
    """Annotate an inference failure with the correct ground truth.

    This creates a correction record that can be fed back into the
    training pipeline.
    """
    annotation = InferenceFailureAnnotation(
        id=f"ann-{uuid.uuid4().hex[:8]}",
        model_key=model_key,
        model_version=model_version,
        image_source=image_source,
        predicted_label=predicted_label,
        predicted_confidence=predicted_confidence,
        correct_label=correct_label,
        correct_bbox=correct_bbox,
        annotation_label=annotation_label,
        annotator=annotator,
        notes=notes,
    )

    annotations = _load_annotations()
    annotations.append(annotation.model_dump())
    _save_annotations(annotations)
    return annotation


def get_annotation(annotation_id: str) -> InferenceFailureAnnotation:
    """Get an annotation by ID."""
    annotations = _load_annotations()
    for a in annotations:
        if a["id"] == annotation_id:
            return InferenceFailureAnnotation(**a)
    raise KeyError(f"Annotation '{annotation_id}' not found.")


def list_annotations(
    model_key: Optional[str] = None,
    annotation_label: Optional[AnnotationLabel] = None,
    unfed_only: bool = False,
) -> list[InferenceFailureAnnotation]:
    """List annotations with optional filters."""
    annotations = _load_annotations()
    result = [InferenceFailureAnnotation(**a) for a in annotations]
    if model_key:
        result = [a for a in result if a.model_key == model_key]
    if annotation_label:
        result = [a for a in result if a.annotation_label == annotation_label]
    if unfed_only:
        result = [a for a in result if not a.fed_back]
    return result


def create_feedback_batch(
    model_key: str,
    output_dataset_path: str,
    *,
    annotation_ids: Optional[list[str]] = None,
    annotation_label: Optional[AnnotationLabel] = None,
) -> FeedbackBatch:
    """Create a feedback batch from annotations.

    Either specify explicit annotation IDs, or use annotation_label to
    batch all matching unfed annotations.
    """
    if annotation_ids:
        selected = annotation_ids
    else:
        unfed = list_annotations(
            model_key=model_key,
            annotation_label=annotation_label,
            unfed_only=True,
        )
        selected = [a.id for a in unfed]

    if not selected:
        raise ValueError("No annotations available for feedback batch.")

    batch = FeedbackBatch(
        id=f"fb-{uuid.uuid4().hex[:8]}",
        model_key=model_key,
        annotations=selected,
        total_annotations=len(selected),
        output_dataset_path=output_dataset_path,
    )

    batches = _load_batches()
    batches.append(batch.model_dump())
    _save_batches(batches)
    return batch


def execute_feedback_batch(batch_id: str) -> FeedbackBatch:
    """Execute a feedback batch — generate a correction dataset.

    Reads all annotations in the batch and writes them as a training-ready
    dataset (JSONL format with image paths, labels, and bounding boxes).
    """
    batches = _load_batches()
    batch_idx = -1
    batch_data = None

    for i, b in enumerate(batches):
        if b["id"] == batch_id:
            batch_data = b
            batch_idx = i
            break

    if batch_data is None:
        raise KeyError(f"Feedback batch '{batch_id}' not found.")

    batch = FeedbackBatch(**batch_data)
    batch.status = PipelineStatus.RUNNING

    try:
        # Load annotations
        corrections = []
        annotations_data = _load_annotations()
        annotation_map = {a["id"]: a for a in annotations_data}

        for ann_id in batch.annotations:
            ann_data = annotation_map.get(ann_id)
            if ann_data is None:
                continue

            ann = InferenceFailureAnnotation(**ann_data)
            correction = {
                "image_source": ann.image_source,
                "label": ann.correct_label,
                "annotation_type": ann.annotation_label.value,
            }
            if ann.correct_bbox:
                correction["bbox"] = ann.correct_bbox
            if ann.notes:
                correction["notes"] = ann.notes
            corrections.append(correction)

        # Write correction dataset
        output_path = Path(batch.output_dataset_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            for c in corrections:
                f.write(json.dumps(c) + "\n")

        # Mark annotations as fed back
        for ann_data in annotations_data:
            if ann_data["id"] in batch.annotations:
                ann_data["fed_back"] = True
        _save_annotations(annotations_data)

        batch.status = PipelineStatus.COMPLETED
        batch.completed_at = datetime.now(timezone.utc).isoformat()

    except Exception as e:
        batch.status = PipelineStatus.FAILED
        batch.error = str(e)

    batches[batch_idx] = batch.model_dump()
    _save_batches(batches)
    return batch


def get_feedback_batch(batch_id: str) -> FeedbackBatch:
    """Get a feedback batch by ID."""
    batches = _load_batches()
    for b in batches:
        if b["id"] == batch_id:
            return FeedbackBatch(**b)
    raise KeyError(f"Feedback batch '{batch_id}' not found.")


def list_feedback_batches(model_key: Optional[str] = None) -> list[FeedbackBatch]:
    """List feedback batches."""
    batches = _load_batches()
    result = [FeedbackBatch(**b) for b in batches]
    if model_key:
        result = [b for b in result if b.model_key == model_key]
    return result
