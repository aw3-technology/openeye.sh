from __future__ import annotations

import math

from perception.models import (
    DetectedObject3D,
    RelationType,
    SpatialRelationship,
)


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
