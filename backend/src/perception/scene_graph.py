"""Scene graph construction and spatial relationship extraction.

Stories:
  47 - 3D position estimates from depth
  48 - Spatial relationships between objects
  50 - Scene graph data structure
  57 - Grasp point suggestions
  58 - Floor plane estimation
"""

from __future__ import annotations

from perception.models import (
    DetectedObject3D,
    RelationType,
    SceneGraphData,
    SceneGraphNode,
    SpatialRelationship,
)

from perception.positioning import (
    _REFERENCE_WIDTHS,
    estimate_3d_position,
    estimate_floor_plane,
)
from perception.relationships import (
    _relationships_2d,
    _relationships_3d,
    derive_spatial_relationships,
)
from perception.grasp import (
    _MANIPULABLE_LABELS,
    suggest_grasp_points,
)

__all__ = [
    "build_scene_graph",
    "estimate_3d_position",
    "estimate_floor_plane",
    "suggest_grasp_points",
    "derive_spatial_relationships",
    "_relationships_3d",
    "_relationships_2d",
    "_REFERENCE_WIDTHS",
    "_MANIPULABLE_LABELS",
]


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
