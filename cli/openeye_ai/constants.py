"""Shared constants for the OpenEye CLI and server."""

from __future__ import annotations

# Labels that denote a human (used by Safety Guardian & watch).
HUMAN_LABELS: frozenset[str] = frozenset(
    {"person", "human", "man", "woman", "child", "pedestrian"}
)


def estimate_depth_from_bbox_height(bbox_h: float) -> float:
    """Rough monocular depth from normalised bounding-box height.

    Assumes a ~1.8 m tall person; clamps to a minimum of 0.3 m.
    """
    return max(0.3, 1.8 / max(bbox_h, 0.01))
