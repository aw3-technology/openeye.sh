"""Scene graph construction and spatial relationship extraction.

Stories:
  47 - 3D position estimates from depth
  48 - Spatial relationships between objects
  50 - Scene graph data structure
  57 - Grasp point suggestions
  58 - Floor plane estimation
"""

from __future__ import annotations

import logging
import math
from typing import Optional

import numpy as np

from perception.models import (
    BBox2D,
    DetectedObject3D,
    FloorPlane,
    GraspPoint,
    Position3D,
    RelationType,
    SceneGraphData,
    SceneGraphNode,
    SpatialRelationship,
)

# Labels considered manipulable for grasp-point estimation
_MANIPULABLE_LABELS = frozenset({
    "cup", "bottle", "bowl", "fork", "knife", "spoon", "banana", "apple",
    "orange", "book", "cell phone", "remote", "scissors", "mouse", "keyboard",
    "toothbrush", "pen", "pencil", "mug", "can", "box", "toy",
})

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


def suggest_grasp_points(obj: DetectedObject3D) -> list[GraspPoint]:
    """Generate grasp point suggestions for a manipulable object."""
    if obj.position_3d is None or not obj.is_manipulable:
        return []

    label_lower = obj.label.lower()
    ref_width = _REFERENCE_WIDTHS.get(label_lower, 0.08)

    # Primary grasp: top-down approach
    top_grasp = GraspPoint(
        object_track_id=obj.track_id,
        position=Position3D(
            x=obj.position_3d.x,
            y=obj.position_3d.y - 0.02,  # slightly above centre
            z=obj.position_3d.z,
        ),
        approach_vector=(0.0, -1.0, 0.0),
        width_m=round(ref_width * 1.1, 3),
        confidence=0.8,
    )

    # Side grasp
    side_grasp = GraspPoint(
        object_track_id=obj.track_id,
        position=obj.position_3d,
        approach_vector=(0.0, 0.0, -1.0),
        width_m=round(ref_width * 1.1, 3),
        confidence=0.6,
    )

    return [top_grasp, side_grasp]


def derive_spatial_relationships(
    objects: list[DetectedObject3D],
    proximity_threshold_m: float = 0.5,
) -> list[SpatialRelationship]:
    """Derive pairwise spatial relationships between detected objects.

    Uses 3D positions when available, falls back to 2D bbox overlap heuristics.
    """
    relationships: list[SpatialRelationship] = []

    for i, a in enumerate(objects):
        for j, b in enumerate(objects):
            if i >= j:
                continue

            if a.position_3d and b.position_3d:
                relationships.extend(_relationships_3d(a, b, proximity_threshold_m))
            else:
                relationships.extend(_relationships_2d(a, b))

    return relationships


def _relationships_3d(
    a: DetectedObject3D, b: DetectedObject3D, prox: float
) -> list[SpatialRelationship]:
    rels: list[SpatialRelationship] = []
    pa, pb = a.position_3d, b.position_3d
    dx = pb.x - pa.x
    dy = pb.y - pa.y
    dz = pb.z - pa.z
    dist = math.sqrt(dx * dx + dy * dy + dz * dz)

    if dist < prox:
        rels.append(SpatialRelationship(
            subject_id=a.track_id,
            relation=RelationType.NEAR,
            object_id=b.track_id,
            confidence=max(0.5, 1.0 - dist / prox),
        ))

    # Vertical relationships
    if dy < -0.05:
        rels.append(SpatialRelationship(
            subject_id=a.track_id,
            relation=RelationType.ABOVE,
            object_id=b.track_id,
            confidence=min(1.0, abs(dy) / 0.3),
        ))
    elif dy > 0.05:
        rels.append(SpatialRelationship(
            subject_id=a.track_id,
            relation=RelationType.BELOW,
            object_id=b.track_id,
            confidence=min(1.0, abs(dy) / 0.3),
        ))

    # Horizontal
    if abs(dx) > 0.1:
        rel = RelationType.LEFT_OF if dx > 0 else RelationType.RIGHT_OF
        rels.append(SpatialRelationship(
            subject_id=a.track_id,
            relation=rel,
            object_id=b.track_id,
            confidence=min(1.0, abs(dx) / 0.5),
        ))

    # ON relationship: a is above b in Y-down camera coords (a.y < b.y)
    # and horizontally overlapping. Also check 2D bbox overlap as a signal.
    h_overlap_2d = min(a.bbox.x2, b.bbox.x2) - max(a.bbox.x1, b.bbox.x1)
    if dy > 0.02 and (abs(dx) < 0.3 or h_overlap_2d > 0) and abs(dz) < 0.3:
        rels.append(SpatialRelationship(
            subject_id=a.track_id,
            relation=RelationType.ON,
            object_id=b.track_id,
            confidence=min(1.0, 0.5 + min(0.5, h_overlap_2d / 100.0 if h_overlap_2d > 0 else 0.2)),
        ))

    return rels


def _relationships_2d(
    a: DetectedObject3D, b: DetectedObject3D
) -> list[SpatialRelationship]:
    """Fallback spatial relationships using 2D bounding box heuristics."""
    rels: list[SpatialRelationship] = []
    ab, bb = a.bbox, b.bbox

    a_cx = (ab.x1 + ab.x2) / 2
    a_cy = (ab.y1 + ab.y2) / 2
    b_cx = (bb.x1 + bb.x2) / 2
    b_cy = (bb.y1 + bb.y2) / 2

    # Horizontal relationship
    dx = b_cx - a_cx
    if abs(dx) > 50:  # pixels
        rel = RelationType.LEFT_OF if dx > 0 else RelationType.RIGHT_OF
        rels.append(SpatialRelationship(
            subject_id=a.track_id,
            relation=rel,
            object_id=b.track_id,
            confidence=0.6,
        ))

    # Vertical: in image coords, lower y = higher in frame
    dy = b_cy - a_cy
    if dy > 30:
        rels.append(SpatialRelationship(
            subject_id=a.track_id,
            relation=RelationType.ABOVE,
            object_id=b.track_id,
            confidence=0.5,
        ))
    elif dy < -30:
        rels.append(SpatialRelationship(
            subject_id=a.track_id,
            relation=RelationType.BELOW,
            object_id=b.track_id,
            confidence=0.5,
        ))

    # ON: a's bottom edge near b's top edge and horizontally overlapping
    h_overlap = min(ab.x2, bb.x2) - max(ab.x1, bb.x1)
    if h_overlap > 0 and abs(ab.y2 - bb.y1) < 20:
        rels.append(SpatialRelationship(
            subject_id=a.track_id,
            relation=RelationType.ON,
            object_id=b.track_id,
            confidence=0.5,
        ))

    return rels


def build_scene_graph(
    objects: list[DetectedObject3D],
    relationships: list[SpatialRelationship],
) -> SceneGraphData:
    """Construct a scene graph from objects and their relationships."""
    nodes: list[SceneGraphNode] = []
    child_set: set[str] = set()

    # Determine parent-child from ON relationships
    for rel in relationships:
        if rel.relation == RelationType.ON:
            child_set.add(rel.subject_id)

    for obj in objects:
        children = [
            rel.subject_id
            for rel in relationships
            if rel.object_id == obj.track_id and rel.relation == RelationType.ON
        ]
        nodes.append(SceneGraphNode(
            track_id=obj.track_id,
            label=obj.label,
            position_3d=obj.position_3d,
            children=children,
        ))

    # Add scene root linking all top-level objects
    root_children = [n.track_id for n in nodes if n.track_id not in child_set]
    root = SceneGraphNode(track_id="scene_root", label="scene", children=root_children)

    return SceneGraphData(
        nodes=[root] + nodes,
        relationships=relationships,
        root_id="scene_root",
    )
