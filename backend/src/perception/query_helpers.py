from __future__ import annotations

from perception.models import DetectedObject3D


def find_objects(label_query: str, objects: list[DetectedObject3D]) -> list[DetectedObject3D]:
    parts = label_query.split()
    target_label = parts[-1] if parts else label_query
    return [
        o for o in objects
        if target_label in o.label.lower() or o.label.lower() in target_label
    ]


def label_for_id(track_id: str, objects: list[DetectedObject3D]) -> str:
    for o in objects:
        if o.track_id == track_id:
            return o.label
    return track_id
