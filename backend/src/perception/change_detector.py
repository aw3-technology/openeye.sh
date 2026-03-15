"""Scene change detection between consecutive frames.

Story 56: Change detection alerts when the scene changes significantly.
"""

from __future__ import annotations

from perception.models import ChangeAlert, ChangeType, DetectedObject3D


class ChangeDetector:
    """Detects significant changes between consecutive perception frames."""

    def __init__(self, movement_threshold_px: float = 30.0):
        self._prev_objects: dict[str, DetectedObject3D] = {}
        self._prev_labels: set[str] = set()
        self._movement_threshold = movement_threshold_px

    def detect(self, objects: list[DetectedObject3D]) -> list[ChangeAlert]:
        current_map = {o.track_id: o for o in objects}
        current_ids = set(current_map.keys())
        prev_ids = set(self._prev_objects.keys())
        alerts: list[ChangeAlert] = []

        # New objects
        appeared = current_ids - prev_ids
        for tid in appeared:
            obj = current_map[tid]
            alerts.append(ChangeAlert(
                change_type=ChangeType.OBJECT_APPEARED,
                description=f"{obj.label} appeared in scene",
                affected_track_ids=[tid],
                magnitude=0.6,
            ))

        # Disappeared objects
        disappeared = prev_ids - current_ids
        for tid in disappeared:
            obj = self._prev_objects[tid]
            alerts.append(ChangeAlert(
                change_type=ChangeType.OBJECT_DISAPPEARED,
                description=f"{obj.label} disappeared from scene",
                affected_track_ids=[tid],
                magnitude=0.6,
            ))

        # Moved objects
        for tid in current_ids & prev_ids:
            cur = current_map[tid]
            prev = self._prev_objects[tid]
            dx = abs((cur.bbox.x1 + cur.bbox.x2) / 2 - (prev.bbox.x1 + prev.bbox.x2) / 2)
            dy = abs((cur.bbox.y1 + cur.bbox.y2) / 2 - (prev.bbox.y1 + prev.bbox.y2) / 2)
            if dx > self._movement_threshold or dy > self._movement_threshold:
                mag = min(1.0, (dx + dy) / (self._movement_threshold * 5))
                alerts.append(ChangeAlert(
                    change_type=ChangeType.OBJECT_MOVED,
                    description=f"{cur.label} moved significantly",
                    affected_track_ids=[tid],
                    magnitude=round(mag, 2),
                ))

        # Overall scene change
        cur_labels = {o.label for o in objects}
        if self._prev_labels and cur_labels != self._prev_labels:
            added = cur_labels - self._prev_labels
            removed = self._prev_labels - cur_labels
            if added or removed:
                parts = []
                if added:
                    parts.append(f"added: {', '.join(sorted(added))}")
                if removed:
                    parts.append(f"removed: {', '.join(sorted(removed))}")
                alerts.append(ChangeAlert(
                    change_type=ChangeType.SCENE_CHANGED,
                    description=f"Scene composition changed ({'; '.join(parts)})",
                    affected_track_ids=list(appeared | disappeared),
                    magnitude=min(1.0, 0.3 + 0.1 * (len(added) + len(removed))),
                ))

        self._prev_objects = current_map
        self._prev_labels = cur_labels
        return alerts
