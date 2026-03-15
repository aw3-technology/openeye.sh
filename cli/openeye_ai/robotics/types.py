"""Re-exports all perception types for convenient SDK access.

Usage::

    from openeye_ai.robotics.types import PerceptionFrame, DetectedObject3D
"""

from openeye_ai.robotics._pipeline_bridge import ensure_backend_path

ensure_backend_path()

from perception.models import (  # noqa: E402
    ActionSuggestion,
    BBox2D,
    ChangeAlert,
    ChangeType,
    DetectedObject3D,
    FloorPlane,
    GraspPoint,
    NLQueryResult,
    PerceptionFrame,
    Position3D,
    RegionOfInterest,
    RelationType,
    SafetyAlert,
    SafetyZone,
    SceneGraphData,
    SceneGraphNode,
    SpatialRelationship,
    ZoneLevel,
)

__all__ = [
    "ActionSuggestion",
    "BBox2D",
    "ChangeAlert",
    "ChangeType",
    "DetectedObject3D",
    "FloorPlane",
    "GraspPoint",
    "NLQueryResult",
    "PerceptionFrame",
    "Position3D",
    "RegionOfInterest",
    "RelationType",
    "SafetyAlert",
    "SafetyZone",
    "SceneGraphData",
    "SceneGraphNode",
    "SpatialRelationship",
    "ZoneLevel",
]
