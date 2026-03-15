"""Safety Guardian — human detection, zone classification, and safety alerts.

Stories:
  52 - Safety alerts when humans enter the workspace
  53 - Zone-based awareness (safe / caution / danger)
"""

from __future__ import annotations

import math
from typing import Optional

from perception.models import (
    DetectedObject3D,
    Position3D,
    SafetyAlert,
    SafetyZone,
    ZoneLevel,
)

# Human-related COCO labels
_HUMAN_LABELS = frozenset({"person", "human", "man", "woman", "child", "pedestrian"})


class SafetyGuardian:
    """Monitors detected humans and classifies proximity zones.

    Parameters
    ----------
    danger_m : float
        Distance threshold for DANGER zone (metres).
    caution_m : float
        Distance threshold for CAUTION zone (metres).
    robot_position : Position3D
        Robot's own position in 3D space (default: camera origin).
    """

    def __init__(
        self,
        danger_m: float = 0.5,
        caution_m: float = 1.5,
        robot_position: Optional[Position3D] = None,
    ):
        self.danger_m = danger_m
        self.caution_m = caution_m
        self.robot_pos = robot_position or Position3D(x=0, y=0, z=0)
        self._previous_human_ids: set[str] = set()

    def evaluate(
        self, objects: list[DetectedObject3D]
    ) -> tuple[list[SafetyAlert], list[SafetyZone]]:
        """Evaluate all detected objects and return safety outputs.

        Returns
        -------
        (alerts, zones)
        """
        humans = [o for o in objects if o.label.lower() in _HUMAN_LABELS]
        alerts: list[SafetyAlert] = []
        zones: list[SafetyZone] = []
        current_ids: set[str] = set()

        for human in humans:
            current_ids.add(human.track_id)
            distance, bearing = self._compute_distance_bearing(human)
            zone = self._classify_zone(distance)

            zones.append(SafetyZone(
                human_track_id=human.track_id,
                zone=zone,
                distance_m=round(distance, 2),
                bearing_deg=round(bearing, 1),
            ))

            # New human entering workspace
            is_new = human.track_id not in self._previous_human_ids

            if zone == ZoneLevel.DANGER:
                alerts.append(SafetyAlert(
                    human_track_id=human.track_id,
                    zone=zone,
                    distance_m=round(distance, 2),
                    message=f"DANGER: Human {human.track_id} at {distance:.2f}m — immediate halt recommended",
                    halt_recommended=True,
                ))
            elif zone == ZoneLevel.CAUTION:
                alerts.append(SafetyAlert(
                    human_track_id=human.track_id,
                    zone=zone,
                    distance_m=round(distance, 2),
                    message=f"CAUTION: Human {human.track_id} at {distance:.2f}m — reduce speed",
                    halt_recommended=False,
                ))
            elif is_new:
                alerts.append(SafetyAlert(
                    human_track_id=human.track_id,
                    zone=zone,
                    distance_m=round(distance, 2),
                    message=f"Human {human.track_id} detected in workspace at {distance:.2f}m",
                    halt_recommended=False,
                ))

        self._previous_human_ids = current_ids
        return alerts, zones

    def _compute_distance_bearing(
        self, human: DetectedObject3D
    ) -> tuple[float, float]:
        """Compute distance and bearing from robot to human."""
        if human.position_3d:
            dx = human.position_3d.x - self.robot_pos.x
            dy = human.position_3d.y - self.robot_pos.y
            dz = human.position_3d.z - self.robot_pos.z
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)
            bearing = math.degrees(math.atan2(dx, dz))
            return dist, bearing

        # Fallback: estimate from bbox size (larger bbox ≈ closer)
        bbox = human.bbox
        bbox_height_ratio = (bbox.y2 - bbox.y1)  # relative to frame
        # Rough: a person filling the frame is ~0.5m away
        estimated_dist = max(0.3, 2.0 / max(bbox_height_ratio, 0.01))
        bbox_cx = (bbox.x1 + bbox.x2) / 2
        bearing = (bbox_cx - 0.5) * 60  # rough FOV mapping
        return estimated_dist, bearing

    def _classify_zone(self, distance_m: float) -> ZoneLevel:
        if distance_m <= self.danger_m:
            return ZoneLevel.DANGER
        elif distance_m <= self.caution_m:
            return ZoneLevel.CAUTION
        return ZoneLevel.SAFE
