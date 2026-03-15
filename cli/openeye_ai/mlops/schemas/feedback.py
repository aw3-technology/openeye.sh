"""Schemas for inference failure annotation and feedback loop (story 192)."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from .enums import AnnotationLabel, PipelineStatus

class InferenceFailureAnnotation(BaseModel):
    """Annotation of an inference failure for correction feedback."""

    id: str
    model_key: str
    model_version: str
    image_source: str = Field(description="Path or URI of the input image")
    predicted_label: str | None = None
    predicted_confidence: float | None = None
    correct_label: str = Field(description="Ground-truth label provided by annotator")
    correct_bbox: dict[str, float] | None = Field(
        default=None, description="Corrected bounding box {x, y, w, h}"
    )
    annotation_label: AnnotationLabel
    annotator: str = ""
    notes: str = ""
    fed_back: bool = Field(default=False, description="Whether this has been added to training data")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FeedbackBatch(BaseModel):
    """A batch of annotations to feed back into the training pipeline."""

    id: str
    model_key: str
    annotations: list[str] = Field(description="List of annotation IDs")
    total_annotations: int = 0
    output_dataset_path: str = Field(description="Path to generated correction dataset")
    status: PipelineStatus = PipelineStatus.IDLE
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: str | None = None
    error: str | None = None
