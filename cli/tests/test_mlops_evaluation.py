"""Tests for openeye_ai.mlops.evaluation — IoU, AP, annotation loading."""

from __future__ import annotations

import json

import pytest


class TestEvaluation:
    def test_compute_iou_perfect_overlap(self):
        from openeye_ai.mlops.evaluation import _compute_iou

        box = {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}
        assert _compute_iou(box, box) == pytest.approx(1.0)

    def test_compute_iou_no_overlap(self):
        from openeye_ai.mlops.evaluation import _compute_iou

        a = {"x": 0.0, "y": 0.0, "w": 0.1, "h": 0.1}
        b = {"x": 0.5, "y": 0.5, "w": 0.1, "h": 0.1}
        assert _compute_iou(a, b) == 0.0

    def test_compute_iou_partial_overlap(self):
        from openeye_ai.mlops.evaluation import _compute_iou

        a = {"x": 0.0, "y": 0.0, "w": 0.2, "h": 0.2}
        b = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}
        iou = _compute_iou(a, b)
        assert 0.0 < iou < 1.0
        # Intersection: 0.1*0.1 = 0.01, Union: 0.04+0.04-0.01 = 0.07
        assert iou == pytest.approx(0.01 / 0.07, rel=1e-6)

    def test_compute_iou_zero_area(self):
        from openeye_ai.mlops.evaluation import _compute_iou

        a = {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}
        b = {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}
        assert _compute_iou(a, b) == 0.0

    def test_compute_ap_empty(self):
        from openeye_ai.mlops.evaluation import _compute_ap

        assert _compute_ap([], []) == 0.0

    def test_compute_ap_perfect(self):
        from openeye_ai.mlops.evaluation import _compute_ap

        precisions = [1.0, 1.0, 1.0]
        recalls = [0.33, 0.67, 1.0]
        ap = _compute_ap(precisions, recalls)
        assert ap == pytest.approx(1.0)

    def test_load_coco_annotations(self, tmp_path):
        from openeye_ai.mlops.evaluation import _load_coco_annotations

        coco = {
            "images": [{"id": 1, "file_name": "img1.jpg"}],
            "categories": [{"id": 1, "name": "person"}],
            "annotations": [
                {"image_id": 1, "category_id": 1, "bbox": [10, 20, 30, 40]},
            ],
        }
        p = tmp_path / "annotations.json"
        p.write_text(json.dumps(coco))
        result = _load_coco_annotations(p)
        assert "img1.jpg" in result
        assert result["img1.jpg"][0]["label"] == "person"
        assert result["img1.jpg"][0]["bbox"] == {"x": 10, "y": 20, "w": 30, "h": 40}

    def test_load_jsonl_annotations(self, tmp_path):
        from openeye_ai.mlops.evaluation import _load_jsonl_annotations

        lines = [
            json.dumps({"image": "a.jpg", "labels": [{"label": "car", "bbox": {"x": 0, "y": 0, "w": 1, "h": 1}}]}),
            json.dumps({"image": "b.jpg", "labels": []}),
        ]
        p = tmp_path / "annotations.jsonl"
        p.write_text("\n".join(lines))
        result = _load_jsonl_annotations(p)
        assert "a.jpg" in result
        assert result["a.jpg"][0]["label"] == "car"
        assert "b.jpg" in result

    def test_load_coco_annotations_missing_image_id(self, tmp_path):
        """Annotations referencing nonexistent image IDs are skipped."""
        from openeye_ai.mlops.evaluation import _load_coco_annotations

        coco = {
            "images": [{"id": 1, "file_name": "img1.jpg"}],
            "categories": [{"id": 1, "name": "person"}],
            "annotations": [
                {"image_id": 1, "category_id": 1, "bbox": [10, 20, 30, 40]},
                {"image_id": 999, "category_id": 1, "bbox": [0, 0, 10, 10]},  # orphan
            ],
        }
        p = tmp_path / "annotations.json"
        p.write_text(json.dumps(coco))
        result = _load_coco_annotations(p)
        assert len(result) == 1
        assert "img1.jpg" in result
        assert len(result["img1.jpg"]) == 1

    def test_load_jsonl_annotations_empty_lines(self, tmp_path):
        """Empty lines in JSONL files should be skipped gracefully."""
        from openeye_ai.mlops.evaluation import _load_jsonl_annotations

        lines = [
            json.dumps({"image": "a.jpg", "labels": [{"label": "car", "bbox": {"x": 0, "y": 0, "w": 1, "h": 1}}]}),
            "",
            "   ",
            json.dumps({"image": "b.jpg", "labels": []}),
        ]
        p = tmp_path / "annotations.jsonl"
        p.write_text("\n".join(lines))
        result = _load_jsonl_annotations(p)
        assert len(result) == 2

    def test_compute_ap_decreasing_precision(self):
        """AP with non-perfect precision-recall curve."""
        from openeye_ai.mlops.evaluation import _compute_ap

        precisions = [1.0, 0.5, 0.33]
        recalls = [0.25, 0.5, 0.75]
        ap = _compute_ap(precisions, recalls)
        assert 0.0 < ap < 1.0
