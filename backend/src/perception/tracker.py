"""Multi-frame object tracker with IoU-based matching.

Story 49: Consistent object identity across frames via track IDs.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from perception.models import BBox2D


@dataclass
class _Track:
    track_id: str
    label: str
    bbox: BBox2D
    last_seen: float
    hits: int = 1
    misses: int = 0


def _iou(a: BBox2D, b: BBox2D) -> float:
    """Compute Intersection over Union between two bounding boxes."""
    xi1 = max(a.x1, b.x1)
    yi1 = max(a.y1, b.y1)
    xi2 = min(a.x2, b.x2)
    yi2 = min(a.y2, b.y2)
    inter = max(0.0, xi2 - xi1) * max(0.0, yi2 - yi1)
    area_a = (a.x2 - a.x1) * (a.y2 - a.y1)
    area_b = (b.x2 - b.x1) * (b.y2 - b.y1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


class ObjectTracker:
    """Greedy IoU tracker that assigns stable IDs across frames.

    Parameters
    ----------
    iou_threshold : float
        Minimum IoU to consider a detection as the same object.
    max_misses : int
        Number of consecutive frames an object can be absent before its track is dropped.
    """

    def __init__(self, iou_threshold: float = 0.3, max_misses: int = 10):
        self._tracks: dict[str, _Track] = {}
        self._next_id: int = 0
        self._iou_threshold = iou_threshold
        self._max_misses = max_misses

    def _make_id(self, label: str) -> str:
        self._next_id += 1
        clean = label.upper().replace(" ", "_")
        return f"{clean}_{self._next_id:04d}"

    def update(
        self, detections: list[dict]
    ) -> list[dict]:
        """Match incoming detections to existing tracks and return augmented detections.

        Parameters
        ----------
        detections : list[dict]
            Raw detections with keys: label, confidence, bbox (x1, y1, x2, y2 or dict).

        Returns
        -------
        list[dict]
            Same detections with an added ``track_id`` key.
        """
        now = time.time()
        # Normalise bboxes
        parsed: list[tuple[dict, BBox2D]] = []
        for det in detections:
            raw_bbox = det["bbox"]
            if isinstance(raw_bbox, dict):
                # Normalised bbox from CLI schema {x, y, w, h}
                bbox = BBox2D(
                    x1=raw_bbox["x"],
                    y1=raw_bbox["y"],
                    x2=raw_bbox["x"] + raw_bbox["w"],
                    y2=raw_bbox["y"] + raw_bbox["h"],
                )
            elif isinstance(raw_bbox, (list, tuple)) and len(raw_bbox) == 4:
                bbox = BBox2D(x1=raw_bbox[0], y1=raw_bbox[1], x2=raw_bbox[2], y2=raw_bbox[3])
            else:
                bbox = raw_bbox  # already BBox2D
            parsed.append((det, bbox))

        # Compute IoU matrix and greedily match
        unmatched_tracks = set(self._tracks.keys())
        results: list[dict] = []

        for det, bbox in parsed:
            best_id: str | None = None
            best_iou = self._iou_threshold

            for tid in unmatched_tracks:
                track = self._tracks[tid]
                # Only match same class
                if track.label != det.get("label", det.get("class", "")):
                    continue
                score = _iou(track.bbox, bbox)
                if score > best_iou:
                    best_iou = score
                    best_id = tid

            if best_id is not None:
                # Update existing track
                track = self._tracks[best_id]
                track.bbox = bbox
                track.last_seen = now
                track.hits += 1
                track.misses = 0
                unmatched_tracks.discard(best_id)
                track_id = best_id
            else:
                # Create new track
                label = det.get("label", det.get("class", "unknown"))
                track_id = self._make_id(label)
                self._tracks[track_id] = _Track(
                    track_id=track_id, label=label, bbox=bbox, last_seen=now
                )

            augmented = {**det, "track_id": track_id, "_bbox_parsed": bbox}
            results.append(augmented)

        # Increment misses for unmatched tracks and prune stale ones
        for tid in unmatched_tracks:
            self._tracks[tid].misses += 1
        self._tracks = {
            tid: t
            for tid, t in self._tracks.items()
            if t.misses <= self._max_misses
        }

        return results

    def get_disappeared(self) -> list[str]:
        """Return track IDs that just exceeded the miss threshold."""
        return [
            tid
            for tid, t in self._tracks.items()
            if t.misses == self._max_misses
        ]

    @property
    def active_tracks(self) -> dict[str, _Track]:
        return {tid: t for tid, t in self._tracks.items() if t.misses == 0}

    def reset(self) -> None:
        self._tracks.clear()
        self._next_id = 0
