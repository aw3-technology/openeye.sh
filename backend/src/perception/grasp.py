from __future__ import annotations

from perception.models import (
    DetectedObject3D,
    GraspPoint,
    Position3D,
)
from perception.positioning import _REFERENCE_WIDTHS

# Labels considered manipulable for grasp-point estimation
_MANIPULABLE_LABELS = frozenset({
    "cup", "bottle", "bowl", "fork", "knife", "spoon", "banana", "apple",
    "orange", "book", "cell phone", "remote", "scissors", "mouse", "keyboard",
    "toothbrush", "pen", "pencil", "mug", "can", "box", "toy",
})


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
