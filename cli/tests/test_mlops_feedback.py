"""Tests for openeye_ai.mlops.feedback."""

from __future__ import annotations

import json

import pytest


class TestFeedback:
    def test_annotate_and_list(self):
        from openeye_ai.mlops.feedback import annotate_failure, list_annotations
        from openeye_ai.mlops.schemas import AnnotationLabel

        ann = annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/img.jpg", correct_label="forklift",
            annotation_label=AnnotationLabel.MISCLASSIFICATION,
            predicted_label="person",
        )
        assert ann.id.startswith("ann-")

        annotations = list_annotations()
        assert len(annotations) == 1
        assert list_annotations(model_key="m") == annotations
        assert list_annotations(model_key="other") == []

    def test_list_annotations_unfed_only(self):
        from openeye_ai.mlops.feedback import annotate_failure, list_annotations
        from openeye_ai.mlops.schemas import AnnotationLabel

        annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/img.jpg", correct_label="x",
            annotation_label=AnnotationLabel.FALSE_POSITIVE,
        )
        assert len(list_annotations(unfed_only=True)) == 1
        assert len(list_annotations(unfed_only=False)) == 1

    def test_create_feedback_batch_no_annotations(self):
        from openeye_ai.mlops.feedback import create_feedback_batch

        with pytest.raises(ValueError, match="No annotations"):
            create_feedback_batch("m", "/output.jsonl")

    def test_execute_feedback_batch(self, tmp_path):
        from openeye_ai.mlops.feedback import (
            annotate_failure,
            create_feedback_batch,
            execute_feedback_batch,
            list_annotations,
        )
        from openeye_ai.mlops.schemas import AnnotationLabel, PipelineStatus

        ann = annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/img.jpg", correct_label="truck",
            annotation_label=AnnotationLabel.MISCLASSIFICATION,
            notes="Was labelled as car",
        )

        output = tmp_path / "corrections.jsonl"
        batch = create_feedback_batch("m", str(output), annotation_ids=[ann.id])
        result = execute_feedback_batch(batch.id)

        assert result.status == PipelineStatus.COMPLETED
        assert output.exists()
        content = output.read_text().strip()
        parsed = json.loads(content)
        assert parsed["label"] == "truck"
        assert parsed["notes"] == "Was labelled as car"

        # Annotation should be marked as fed back
        unfed = list_annotations(unfed_only=True)
        assert len(unfed) == 0

    def test_get_feedback_batch_not_found(self):
        from openeye_ai.mlops.feedback import get_feedback_batch

        with pytest.raises(KeyError):
            get_feedback_batch("fb-nope")

    def test_get_annotation_not_found(self):
        from openeye_ai.mlops.feedback import get_annotation

        with pytest.raises(KeyError, match="not found"):
            get_annotation("ann-nonexistent")

    def test_get_annotation_success(self):
        from openeye_ai.mlops.feedback import annotate_failure, get_annotation
        from openeye_ai.mlops.schemas import AnnotationLabel

        ann = annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/img.jpg", correct_label="truck",
            annotation_label=AnnotationLabel.MISCLASSIFICATION,
        )
        fetched = get_annotation(ann.id)
        assert fetched.id == ann.id
        assert fetched.correct_label == "truck"

    def test_list_annotations_by_label(self):
        from openeye_ai.mlops.feedback import annotate_failure, list_annotations
        from openeye_ai.mlops.schemas import AnnotationLabel

        annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/a.jpg", correct_label="x",
            annotation_label=AnnotationLabel.FALSE_POSITIVE,
        )
        annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/b.jpg", correct_label="y",
            annotation_label=AnnotationLabel.MISCLASSIFICATION,
        )
        assert len(list_annotations(annotation_label=AnnotationLabel.FALSE_POSITIVE)) == 1
        assert len(list_annotations(annotation_label=AnnotationLabel.MISCLASSIFICATION)) == 1

    def test_list_feedback_batches(self, tmp_path):
        from openeye_ai.mlops.feedback import annotate_failure, create_feedback_batch, list_feedback_batches
        from openeye_ai.mlops.schemas import AnnotationLabel

        ann = annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/img.jpg", correct_label="x",
            annotation_label=AnnotationLabel.FALSE_POSITIVE,
        )
        create_feedback_batch("m", str(tmp_path / "out.jsonl"), annotation_ids=[ann.id])
        batches = list_feedback_batches()
        assert len(batches) == 1
        assert list_feedback_batches(model_key="m") == batches
        assert list_feedback_batches(model_key="other") == []

    def test_execute_feedback_batch_skips_missing_annotation(self, tmp_path):
        """Batch with a non-existent annotation ID should skip it without error."""
        from openeye_ai.mlops.feedback import annotate_failure, create_feedback_batch, execute_feedback_batch
        from openeye_ai.mlops.schemas import AnnotationLabel, PipelineStatus

        ann = annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/img.jpg", correct_label="truck",
            annotation_label=AnnotationLabel.MISCLASSIFICATION,
        )
        output = tmp_path / "corrections.jsonl"
        batch = create_feedback_batch(
            "m", str(output),
            annotation_ids=[ann.id, "ann-does-not-exist"],
        )
        result = execute_feedback_batch(batch.id)
        assert result.status == PipelineStatus.COMPLETED
        # Only the real annotation should be in the output
        content = output.read_text().strip().split("\n")
        assert len(content) == 1

    def test_create_feedback_batch_auto_select_unfed(self):
        """create_feedback_batch without explicit IDs selects all unfed annotations."""
        from openeye_ai.mlops.feedback import annotate_failure, create_feedback_batch
        from openeye_ai.mlops.schemas import AnnotationLabel

        annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/a.jpg", correct_label="x",
            annotation_label=AnnotationLabel.FALSE_POSITIVE,
        )
        annotate_failure(
            model_key="m", model_version="1.0",
            image_source="/b.jpg", correct_label="y",
            annotation_label=AnnotationLabel.MISCLASSIFICATION,
        )
        batch = create_feedback_batch("m", "/tmp/out.jsonl")
        assert batch.total_annotations == 2
