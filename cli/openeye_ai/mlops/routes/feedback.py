"""API routes for annotations and feedback (story 192)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import AnnotationLabel

router = APIRouter()

@router.post("/annotations")
async def create_annotation_endpoint(
    model_key: str,
    model_version: str,
    image_source: str,
    correct_label: str,
    annotation_label: AnnotationLabel,
    predicted_label: str | None = None,
    predicted_confidence: float | None = None,
    annotator: str = "",
    notes: str = "",
):
    """Annotate an inference failure."""
    from ..feedback import annotate_failure

    return annotate_failure(
        model_key=model_key,
        model_version=model_version,
        image_source=image_source,
        correct_label=correct_label,
        annotation_label=annotation_label,
        predicted_label=predicted_label,
        predicted_confidence=predicted_confidence,
        annotator=annotator,
        notes=notes,
    ).model_dump()

@router.get("/annotations")
async def list_annotations_endpoint(
    model_key: str | None = None,
    annotation_label: AnnotationLabel | None = None,
    unfed_only: bool = False,
):
    """List annotations."""
    from ..feedback import list_annotations

    return [a.model_dump() for a in list_annotations(model_key, annotation_label, unfed_only)]

@router.post("/feedback-batches")
async def create_feedback_batch_endpoint(
    model_key: str,
    output_dataset_path: str,
    annotation_ids: list[str] | None = None,
):
    """Create and execute a feedback batch."""
    from ..feedback import create_feedback_batch, execute_feedback_batch

    try:
        batch = create_feedback_batch(model_key, output_dataset_path, annotation_ids=annotation_ids)
        batch = execute_feedback_batch(batch.id)
        return batch.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/feedback-batches")
async def list_feedback_batches_endpoint(model_key: str | None = None):
    """List feedback batches."""
    from ..feedback import list_feedback_batches

    return [b.model_dump() for b in list_feedback_batches(model_key)]
