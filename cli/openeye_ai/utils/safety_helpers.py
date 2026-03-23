"""Shared safety-related helpers used by both watch and G1 demo commands.

Deduplicates the detection-to-3D conversion and safety panel building
that was previously copy-pasted across watch_helpers.py and g1_safety_demo.py.
"""

from __future__ import annotations

_HUMAN_LABELS = {"person", "human", "man", "woman", "child", "pedestrian"}


def detections_to_3d(
    result: dict,
    BBox2D,
    DetectedObject3D,
    Position3D,
) -> list:
    """Convert flat detection dicts into DetectedObject3D instances.

    Uses a simple pinhole-camera heuristic: estimated depth is inversely
    proportional to the bounding-box height (assumes ~1.8 m human height).
    """
    objects_3d = []
    for i, obj in enumerate(result.get("objects", []) if isinstance(result, dict) else result):
        bbox = obj.get("bbox", {}) if isinstance(obj, dict) else obj
        bbox_h = bbox.get("h", 0.1)
        estimated_depth = max(0.3, 1.8 / max(bbox_h, 0.01))

        bx = bbox.get("x", 0)
        by = bbox.get("y", 0)
        bw = bbox.get("w", 0)

        objects_3d.append(DetectedObject3D(
            track_id=f"obj_{i}",
            label=obj.get("label", "unknown") if isinstance(obj, dict) else "unknown",
            confidence=obj.get("confidence", 0.0) if isinstance(obj, dict) else 0.0,
            bbox=BBox2D(
                x1=bx,
                y1=by,
                x2=bx + bw,
                y2=by + bbox.get("h", 0),
            ),
            position_3d=Position3D(
                x=(bx + bw / 2 - 0.5) * estimated_depth,
                y=0.0,
                z=estimated_depth,
            ),
        ))
    return objects_3d


def count_humans(objects_3d) -> int:
    """Count objects whose label matches common human labels."""
    return sum(1 for o in objects_3d if o.label.lower() in _HUMAN_LABELS)
