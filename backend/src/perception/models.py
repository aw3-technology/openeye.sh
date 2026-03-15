"""Data models for the unified perception pipeline.

Covers user stories:
  46 - Unified perception output (PerceptionFrame)
  47 - 3D position estimates (DetectedObject3D)
  48 - Spatial relationships (SpatialRelationship)
  49 - Tracking IDs (DetectedObject3D.track_id)
  50 - Scene graph (SceneGraphData)
  51 - Action suggestions (ActionSuggestion)
  52 - Safety alerts (SafetyAlert)
  53 - Zone-based awareness (SafetyZone)
  55 - Region of interest (RegionOfInterest)
  56 - Change detection alerts (ChangeAlert)
  57 - Grasp point suggestions (GraspPoint)
  58 - Floor plane estimation (FloorPlane)
  60 - Natural language queries (NLQueryResult)
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
#  Enums
# --------------------------------------------------------------------------- #


class ZoneLevel(str, Enum):
    SAFE = "safe"
    CAUTION = "caution"
    DANGER = "danger"


class RelationType(str, Enum):
    ON = "ON"
    UNDER = "UNDER"
    NEAR = "NEAR"
    LEFT_OF = "LEFT_OF"
    RIGHT_OF = "RIGHT_OF"
    ABOVE = "ABOVE"
    BELOW = "BELOW"
    INSIDE = "INSIDE"
    BEHIND = "BEHIND"
    IN_FRONT_OF = "IN_FRONT_OF"


class ChangeType(str, Enum):
    OBJECT_APPEARED = "object_appeared"
    OBJECT_DISAPPEARED = "object_disappeared"
    OBJECT_MOVED = "object_moved"
    SCENE_CHANGED = "scene_changed"


# --------------------------------------------------------------------------- #
#  Core geometry
# --------------------------------------------------------------------------- #


class BBox2D(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class Position3D(BaseModel):
    x: float = Field(description="Metres from camera centre (right-positive)")
    y: float = Field(description="Metres downward from camera")
    z: float = Field(description="Metres depth from camera")


class FloorPlane(BaseModel):
    """Estimated floor plane for navigation."""
    normal: tuple[float, float, float] = Field(
        description="Unit normal vector of the floor plane (nx, ny, nz)"
    )
    height: float = Field(description="Floor height relative to camera in metres")
    confidence: float = Field(ge=0, le=1)


# --------------------------------------------------------------------------- #
#  Object-level
# --------------------------------------------------------------------------- #


class GraspPoint(BaseModel):
    """Suggested grasp point on a manipulable object."""
    object_track_id: str
    position: Position3D
    approach_vector: tuple[float, float, float] = Field(
        description="Unit vector for gripper approach direction"
    )
    width_m: float = Field(description="Suggested gripper opening in metres")
    confidence: float = Field(ge=0, le=1)


class DetectedObject3D(BaseModel):
    """A single detected object with optional 3D position."""
    track_id: str = Field(description="Consistent identity across frames")
    label: str
    confidence: float = Field(ge=0, le=1)
    bbox: BBox2D
    position_3d: Optional[Position3D] = Field(
        default=None,
        description="3D position estimate (available when depth data is present)",
    )
    depth_m: Optional[float] = Field(
        default=None, description="Median depth in metres for this object"
    )
    is_manipulable: bool = Field(
        default=False, description="Whether this object can be grasped"
    )
    grasp_points: list[GraspPoint] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
#  Spatial / relational
# --------------------------------------------------------------------------- #


class SpatialRelationship(BaseModel):
    subject_id: str
    relation: RelationType
    object_id: str
    confidence: float = Field(ge=0, le=1)


class SceneGraphNode(BaseModel):
    track_id: str
    label: str
    position_3d: Optional[Position3D] = None
    children: list[str] = Field(
        default_factory=list, description="Track IDs of child nodes"
    )


class SceneGraphData(BaseModel):
    """Full scene graph for a single frame."""
    nodes: list[SceneGraphNode] = Field(default_factory=list)
    relationships: list[SpatialRelationship] = Field(default_factory=list)
    root_id: str = Field(default="scene_root")


# --------------------------------------------------------------------------- #
#  Safety
# --------------------------------------------------------------------------- #


class SafetyZone(BaseModel):
    """Zone classification relative to a detected human."""
    human_track_id: str
    zone: ZoneLevel
    distance_m: float = Field(description="Distance from robot origin in metres")
    bearing_deg: float = Field(description="Bearing angle in degrees, 0 = forward")


class SafetyAlert(BaseModel):
    """Alert generated when a human enters the workspace."""
    human_track_id: str
    zone: ZoneLevel
    distance_m: float
    message: str
    halt_recommended: bool = Field(
        default=False,
        description="True when immediate halt is recommended",
    )


# --------------------------------------------------------------------------- #
#  Change detection
# --------------------------------------------------------------------------- #


class ChangeAlert(BaseModel):
    change_type: ChangeType
    description: str
    affected_track_ids: list[str] = Field(default_factory=list)
    magnitude: float = Field(
        ge=0, le=1, description="How significant the change is (0-1)"
    )


# --------------------------------------------------------------------------- #
#  Action suggestions
# --------------------------------------------------------------------------- #


class ActionSuggestion(BaseModel):
    action: str = Field(description="Suggested action type")
    target_id: Optional[str] = Field(
        default=None, description="Track ID of the target object"
    )
    reason: str = Field(description="Why this action is suggested")
    priority: float = Field(ge=0, le=1, description="Priority score")


# --------------------------------------------------------------------------- #
#  Region of interest
# --------------------------------------------------------------------------- #


class RegionOfInterest(BaseModel):
    """Defines a sub-region of the frame to focus perception on."""
    x1: float = Field(ge=0, le=1, description="Normalised left edge")
    y1: float = Field(ge=0, le=1, description="Normalised top edge")
    x2: float = Field(ge=0, le=1, description="Normalised right edge")
    y2: float = Field(ge=0, le=1, description="Normalised bottom edge")


# --------------------------------------------------------------------------- #
#  Natural-language query
# --------------------------------------------------------------------------- #


class NLQueryResult(BaseModel):
    query: str
    answer: str
    matched_objects: list[str] = Field(
        default_factory=list, description="Track IDs of relevant objects"
    )
    confidence: float = Field(ge=0, le=1)


# --------------------------------------------------------------------------- #
#  Unified frame output  (Story 46)
# --------------------------------------------------------------------------- #


class PerceptionFrame(BaseModel):
    """Unified perception output combining all pipeline stages for a single frame."""
    frame_id: int
    timestamp: float
    inference_ms: float = Field(description="Total pipeline latency in milliseconds")

    # Core detections  (47, 49)
    objects: list[DetectedObject3D] = Field(default_factory=list)

    # Scene understanding  (48, 50)
    scene_graph: SceneGraphData = Field(default_factory=SceneGraphData)
    scene_description: str = Field(
        default="", description="Natural-language summary of the scene"
    )

    # Safety  (52, 53)
    safety_alerts: list[SafetyAlert] = Field(default_factory=list)
    safety_zones: list[SafetyZone] = Field(default_factory=list)

    # Action suggestions  (51)
    action_suggestions: list[ActionSuggestion] = Field(default_factory=list)

    # Change detection  (56)
    change_alerts: list[ChangeAlert] = Field(default_factory=list)

    # Floor plane  (58)
    floor_plane: Optional[FloorPlane] = None

    # Depth availability
    depth_available: bool = Field(
        default=False, description="Whether depth data was used this frame"
    )

    # ROI used  (55)
    roi: Optional[RegionOfInterest] = Field(
        default=None, description="Region of interest that was applied, if any"
    )

    # Governance verdict (when governance engine is active)
    governance_verdict: Optional[dict] = Field(
        default=None, description="Governance evaluation result, if governance engine is active"
    )
