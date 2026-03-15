"""3D object construction from tracked detections and depth data.

Stories:
  47 - 3D position estimates when depth available
  57 - Grasp point suggestions
"""

from __future__ import annotations

from typing import Optional

import numpy as np

from perception.models import BBox2D, DetectedObject3D
from perception.scene_graph import (
    _MANIPULABLE_LABELS,
    estimate_3d_position,
    suggest_grasp_points,
)


def build_objects_3d(
    tracked: list[dict],
    depth_map: Optional[np.ndarray],
    frame_w: int,
    frame_h: int,
) -> list[DetectedObject3D]:
    """Build 3D object representations from tracked detections."""
    objects: list[DetectedObject3D] = []
    for det in tracked:
        bbox: BBox2D = det["_bbox_parsed"]
        label = det.get("label", det.get("class", "unknown"))
        is_manip = label.lower() in _MANIPULABLE_LABELS

        pos_3d, depth_m = estimate_3d_position(
            bbox, depth_map, frame_w, frame_h
        ) if depth_map is not None else (None, None)

        obj = DetectedObject3D(
            track_id=det["track_id"],
            label=label,
            confidence=det.get("confidence", 0.0),
            bbox=bbox,
            position_3d=pos_3d,
            depth_m=depth_m,
            is_manipulable=is_manip,
        )

        if is_manip:
            obj.grasp_points = suggest_grasp_points(obj)

        objects.append(obj)
    return objects
