"""Model evaluation — precision, recall, mAP (story 74)."""

from __future__ import annotations

import json
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

from PIL import Image

from .schemas import EvaluationMetrics

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}


def _compute_iou(box_a: dict, box_b: dict) -> float:
    """Compute IoU between two boxes in {x, y, w, h} format (normalised)."""
    ax1, ay1 = box_a["x"], box_a["y"]
    ax2, ay2 = ax1 + box_a["w"], ay1 + box_a["h"]
    bx1, by1 = box_b["x"], box_b["y"]
    bx2, by2 = bx1 + box_b["w"], by1 + box_b["h"]

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)

    area_a = box_a["w"] * box_a["h"]
    area_b = box_b["w"] * box_b["h"]
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _compute_ap(precisions: list[float], recalls: list[float]) -> float:
    """Compute Average Precision using 11-point interpolation."""
    if not precisions or not recalls:
        return 0.0

    ap = 0.0
    for t in [i / 10.0 for i in range(11)]:
        # Max precision at recall >= t
        p = max(
            (p for p, r in zip(precisions, recalls) if r >= t),
            default=0.0,
        )
        ap += p / 11.0
    return ap


def _load_coco_annotations(dataset_path: Path) -> dict[str, list[dict]]:
    """Load COCO-format JSON and return {filename: [annotations]}."""
    with open(dataset_path, encoding="utf-8") as f:
        coco = json.load(f)

    # Build image_id -> filename map
    id_to_file = {}
    for img in coco.get("images", []):
        id_to_file[img["id"]] = img["file_name"]

    # Build category_id -> name map
    id_to_cat = {}
    for cat in coco.get("categories", []):
        id_to_cat[cat["id"]] = cat["name"]

    # Group annotations by image filename
    result: dict[str, list[dict]] = defaultdict(list)
    for ann in coco.get("annotations", []):
        fname = id_to_file.get(ann["image_id"])
        if fname is None:
            continue
        bbox = ann.get("bbox", [0, 0, 0, 0])  # COCO: [x, y, w, h] in pixels
        cat = id_to_cat.get(ann["category_id"], "unknown")
        result[fname].append({
            "label": cat,
            "bbox": {"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]},
        })
    return dict(result)


def _load_jsonl_annotations(dataset_path: Path) -> dict[str, list[dict]]:
    """Load JSONL annotation file: each line has {image, labels: [{label, bbox}]}."""
    result: dict[str, list[dict]] = {}
    with open(dataset_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            image = entry.get("image", "")
            labels = entry.get("labels", entry.get("annotations", []))
            result[image] = labels
    return result


def evaluate_model(
    adapter,
    dataset_path: Path,
    *,
    iou_threshold: float = 0.5,
    confidence_threshold: float = 0.25,
    image_dir: Optional[Path] = None,
) -> EvaluationMetrics:
    """Evaluate a loaded model against a labelled dataset.

    Supports COCO JSON and JSONL annotation formats.
    Returns precision, recall, F1, and mAP metrics.
    """
    # Load ground truth
    if dataset_path.suffix == ".json":
        gt_by_image = _load_coco_annotations(dataset_path)
        # Try to find images relative to dataset file
        if image_dir is None:
            image_dir = dataset_path.parent
    elif dataset_path.suffix in (".jsonl", ".ndjson"):
        gt_by_image = _load_jsonl_annotations(dataset_path)
        if image_dir is None:
            image_dir = dataset_path.parent
    else:
        raise ValueError(
            f"Unsupported dataset format: {dataset_path.suffix}. "
            "Use COCO JSON (.json) or JSONL (.jsonl)."
        )

    if not gt_by_image:
        raise ValueError("Dataset contains no annotations.")

    # Collect per-class predictions and ground truths
    all_tp = 0
    all_fp = 0
    all_fn = 0
    total_preds = 0
    total_gt = 0
    per_class_preds: dict[str, list[tuple[float, bool]]] = defaultdict(list)
    per_class_gt_count: dict[str, int] = defaultdict(int)

    for image_name, gt_boxes in gt_by_image.items():
        img_path = image_dir / image_name
        if not img_path.exists():
            continue

        img = Image.open(img_path).convert("RGB")
        result = adapter.predict(img)
        predictions = result.get("objects", [])

        # Filter by confidence
        predictions = [
            p for p in predictions
            if p.get("confidence", 1.0) >= confidence_threshold
        ]

        total_preds += len(predictions)
        total_gt += len(gt_boxes)

        # Count ground truth per class
        for gt in gt_boxes:
            per_class_gt_count[gt["label"]] += 1

        # Match predictions to ground truth
        matched_gt = set()
        for pred in sorted(predictions, key=lambda p: -p.get("confidence", 0)):
            best_iou = 0.0
            best_gt_idx = -1
            pred_bbox = pred.get("bbox", {})

            for gi, gt in enumerate(gt_boxes):
                if gi in matched_gt:
                    continue
                if pred.get("label") != gt.get("label"):
                    continue
                iou = _compute_iou(pred_bbox, gt.get("bbox", {}))
                if iou > best_iou:
                    best_iou = iou
                    best_gt_idx = gi

            is_tp = best_iou >= iou_threshold and best_gt_idx >= 0
            if is_tp:
                matched_gt.add(best_gt_idx)
                all_tp += 1
            else:
                all_fp += 1

            per_class_preds[pred.get("label", "unknown")].append(
                (pred.get("confidence", 1.0), is_tp)
            )

        all_fn += len(gt_boxes) - len(matched_gt)

    # Compute overall metrics
    precision = all_tp / (all_tp + all_fp) if (all_tp + all_fp) > 0 else 0.0
    recall = all_tp / (all_tp + all_fn) if (all_tp + all_fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    # Compute per-class AP and mAP
    per_class_ap: dict[str, float] = {}
    for cls_name, preds in per_class_preds.items():
        preds.sort(key=lambda x: -x[0])  # Sort by confidence descending
        tp_cumsum = 0
        precisions = []
        recalls_list = []
        n_gt = per_class_gt_count.get(cls_name, 0)

        for conf, is_tp in preds:
            if is_tp:
                tp_cumsum += 1
            p = tp_cumsum / len(precisions + [1])  # Current index+1
            r = tp_cumsum / n_gt if n_gt > 0 else 0.0
            precisions.append(tp_cumsum / (len(precisions) + 1))
            recalls_list.append(r)

        per_class_ap[cls_name] = _compute_ap(precisions, recalls_list)

    mAP = sum(per_class_ap.values()) / len(per_class_ap) if per_class_ap else 0.0

    return EvaluationMetrics(
        precision=precision,
        recall=recall,
        f1=f1,
        mAP=mAP,
        total_images=len(gt_by_image),
        total_predictions=total_preds,
        total_ground_truth=total_gt,
        per_class=per_class_ap,
    )
