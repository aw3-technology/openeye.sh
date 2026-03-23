from __future__ import annotations

from typing import Optional

import numpy as np

from perception.models import (
    BBox2D,
    DetectedObject3D,
    FloorPlane,
    Position3D,
)

# Approximate real-world widths (metres) for common COCO classes
_REFERENCE_WIDTHS: dict[str, float] = {
    "person": 0.45,
    "cup": 0.08,
    "bottle": 0.07,
    "chair": 0.50,
    "dining table": 1.20,
    "laptop": 0.35,
    "book": 0.20,
    "cell phone": 0.07,
    "keyboard": 0.45,
    "mouse": 0.06,
    "apple": 0.08,
    "banana": 0.18,
    "bowl": 0.16,
    "knife": 0.25,
    "fork": 0.18,
    "spoon": 0.16,
}


def estimate_3d_position(
    bbox: BBox2D,
    depth_map: Optional[np.ndarray],
    frame_width: int,
    frame_height: int,
    fx: float = 600.0,
    fy: float = 600.0,
) -> tuple[Optional[Position3D], Optional[float]]:
    """Estimate 3D position from 2D bbox + depth map.

    Parameters
    ----------
    bbox : BBox2D
        Bounding box in pixel coordinates.
    depth_map : np.ndarray or None
        HxW depth map in metres (or normalised 0-1 from Depth Anything).
    frame_width, frame_height : int
        Frame dimensions.
    fx, fy : float
        Approximate focal lengths in pixels.

    Returns
    -------
    (Position3D | None, depth_m | None)
    """
    if depth_map is None:
        return None, None

    h_map, w_map = depth_map.shape[:2]
    # Map bbox pixel coords to depth map coords
    sx = w_map / frame_width
    sy = h_map / frame_height
    x1 = int(max(0, bbox.x1 * sx))
    y1 = int(max(0, bbox.y1 * sy))
    x2 = int(min(w_map, bbox.x2 * sx))
    y2 = int(min(h_map, bbox.y2 * sy))

    if x2 <= x1 or y2 <= y1:
        return None, None

    roi = depth_map[y1:y2, x1:x2]
    valid = roi[roi > 0]
    if len(valid) == 0:
        return None, None

    depth_m = float(np.median(valid))

    # Back-project centre to 3D
    cx = (bbox.x1 + bbox.x2) / 2.0
    cy = (bbox.y1 + bbox.y2) / 2.0
    X = (cx - frame_width / 2.0) * depth_m / fx
    Y = (cy - frame_height / 2.0) * depth_m / fy
    Z = depth_m

    return Position3D(x=round(X, 3), y=round(Y, 3), z=round(Z, 3)), round(depth_m, 3)


def estimate_floor_plane(
    objects: list[DetectedObject3D],
    depth_map: Optional[np.ndarray],
) -> Optional[FloorPlane]:
    """Estimate the floor plane from object positions and depth.

    Uses a heuristic: the lowest detected objects (by Y coordinate) are
    assumed to rest on the floor.
    """
    if depth_map is None:
        return None

    grounded = [o for o in objects if o.position_3d is not None]
    if len(grounded) < 2:
        # Fallback: use bottom row of depth map
        h, w = depth_map.shape[:2]
        bottom_strip = depth_map[int(h * 0.85):, :]
        valid = bottom_strip[bottom_strip > 0]
        if len(valid) == 0:
            return None
        floor_depth = float(np.median(valid))
        return FloorPlane(normal=(0.0, -1.0, 0.0), height=floor_depth, confidence=0.4)

    # Take the lowest objects (highest Y in camera coords)
    grounded.sort(key=lambda o: o.position_3d.y, reverse=True)
    floor_y = np.mean([o.position_3d.y for o in grounded[:3]])
    return FloorPlane(
        normal=(0.0, -1.0, 0.0),
        height=round(float(floor_y), 3),
        confidence=min(0.9, 0.3 + 0.15 * len(grounded)),
    )
