"""Frame preprocessing utilities — ROI cropping and lighting normalisation.

Stories:
  55 - Region-of-interest focused perception
  59 - Varied lighting robustness
"""

from __future__ import annotations

import numpy as np

from perception.models import RegionOfInterest


def apply_roi(frame: np.ndarray, roi: RegionOfInterest) -> np.ndarray:
    """Crop frame to the specified region of interest."""
    h, w = frame.shape[:2]
    x1 = int(roi.x1 * w)
    y1 = int(roi.y1 * h)
    x2 = int(roi.x2 * w)
    y2 = int(roi.y2 * h)
    return frame[y1:y2, x1:x2]


def unmap_roi_detections(
    detections: list[dict],
    roi: RegionOfInterest,
    full_w: int,
    full_h: int,
) -> list[dict]:
    """Map ROI-relative bbox coordinates back to full frame coordinates."""
    roi_w = (roi.x2 - roi.x1) * full_w
    roi_h = (roi.y2 - roi.y1) * full_h
    offset_x = roi.x1 * full_w
    offset_y = roi.y1 * full_h

    mapped = []
    for det in detections:
        d = dict(det)
        bbox = d.get("bbox")
        if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
            d["bbox"] = [
                bbox[0] + offset_x,
                bbox[1] + offset_y,
                bbox[2] + offset_x,
                bbox[3] + offset_y,
            ]
        elif isinstance(bbox, dict) and all(k in bbox for k in ("x", "y", "w", "h")):
            d["bbox"] = {
                "x": bbox["x"] * roi_w / full_w + roi.x1,
                "y": bbox["y"] * roi_h / full_h + roi.y1,
                "w": bbox["w"] * roi_w / full_w,
                "h": bbox["h"] * roi_h / full_h,
            }
        mapped.append(d)
    return mapped


def normalize_lighting(frame: np.ndarray) -> np.ndarray:
    """Apply CLAHE for lighting normalisation (story 59).

    Works across daylight, indoor, and dim lighting conditions.
    """
    try:
        import cv2
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(l_channel)
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    except Exception:
        return frame
