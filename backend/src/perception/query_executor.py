from __future__ import annotations

from perception.models import (
    DetectedObject3D,
    NLQueryResult,
    RelationType,
    SceneGraphData,
)
from perception.query_helpers import find_objects, label_for_id


def execute_count(
    raw_q: str, label: str, objects: list[DetectedObject3D]
) -> NLQueryResult:
    if label in ("object", "thing", "item"):
        count = len(objects)
        return NLQueryResult(
            query=raw_q,
            answer=f"There {'is' if count == 1 else 'are'} {count} object{'s' if count != 1 else ''} in the scene.",
            matched_objects=[o.track_id for o in objects],
            confidence=0.9,
        )
    matches = find_objects(label, objects)
    count = len(matches)
    word = label if count == 1 else f"{label}s"
    return NLQueryResult(
        query=raw_q,
        answer=f"There {'is' if count == 1 else 'are'} {count} {word} in the scene.",
        matched_objects=[m.track_id for m in matches],
        confidence=0.9 if matches else 0.7,
    )


def execute_existence(
    raw_q: str, desc: str, objects: list[DetectedObject3D],
    scene_graph: SceneGraphData,
) -> NLQueryResult:
    matches = find_objects(desc, objects)
    if matches:
        return NLQueryResult(
            query=raw_q,
            answer=f"Yes, there {'is' if len(matches) == 1 else 'are'} {len(matches)} {desc} detected.",
            matched_objects=[m.track_id for m in matches],
            confidence=max(m.confidence for m in matches),
        )
    return NLQueryResult(
        query=raw_q,
        answer=f"No, I don't see any {desc} in the current scene.",
        matched_objects=[],
        confidence=0.8,
    )


def execute_location(
    raw_q: str, label: str, objects: list[DetectedObject3D],
    scene_graph: SceneGraphData,
) -> NLQueryResult:
    matches = find_objects(label, objects)
    if not matches:
        return NLQueryResult(
            query=raw_q,
            answer=f"I don't see any {label} in the current scene.",
            matched_objects=[],
            confidence=0.8,
        )

    descriptions = []
    for obj in matches:
        if obj.position_3d:
            descriptions.append(
                f"{obj.label} ({obj.track_id}) is at "
                f"x={obj.position_3d.x:.2f}m, y={obj.position_3d.y:.2f}m, z={obj.position_3d.z:.2f}m"
            )
        else:
            cx = (obj.bbox.x1 + obj.bbox.x2) / 2
            pos = "left" if cx < 0.33 else ("right" if cx > 0.66 else "centre")
            descriptions.append(f"{obj.label} ({obj.track_id}) is in the {pos} of the frame")

    for rel in scene_graph.relationships:
        if rel.subject_id in [m.track_id for m in matches]:
            target_label = label_for_id(rel.object_id, objects)
            descriptions.append(
                f"  → {rel.relation.value} {target_label}"
            )

    return NLQueryResult(
        query=raw_q,
        answer="; ".join(descriptions) + ".",
        matched_objects=[m.track_id for m in matches],
        confidence=0.85,
    )


def execute_relation(
    raw_q: str, subj_label: str, relation_word: str, obj_label: str,
    objects: list[DetectedObject3D], scene_graph: SceneGraphData,
) -> NLQueryResult:
    subj_matches = find_objects(subj_label, objects)
    obj_matches = find_objects(obj_label, objects)

    if not subj_matches:
        return NLQueryResult(
            query=raw_q,
            answer=f"No {subj_label} detected in the scene.",
            matched_objects=[],
            confidence=0.8,
        )
    if not obj_matches:
        return NLQueryResult(
            query=raw_q,
            answer=f"No {obj_label} detected in the scene.",
            matched_objects=[],
            confidence=0.8,
        )

    rel_map = {
        "on": RelationType.ON,
        "near": RelationType.NEAR,
        "next to": RelationType.NEAR,
        "above": RelationType.ABOVE,
        "below": RelationType.BELOW,
        "left of": RelationType.LEFT_OF,
        "right of": RelationType.RIGHT_OF,
        "in front of": RelationType.IN_FRONT_OF,
        "behind": RelationType.BEHIND,
    }
    target_rel = rel_map.get(relation_word)

    subj_ids = {m.track_id for m in subj_matches}
    obj_ids = {m.track_id for m in obj_matches}

    found = [
        r for r in scene_graph.relationships
        if r.subject_id in subj_ids
        and r.object_id in obj_ids
        and (target_rel is None or r.relation == target_rel)
    ]

    if found:
        return NLQueryResult(
            query=raw_q,
            answer=f"Yes, {subj_label} is {relation_word} {obj_label}.",
            matched_objects=list(subj_ids | obj_ids),
            confidence=max(r.confidence for r in found),
        )

    return NLQueryResult(
        query=raw_q,
        answer=f"No, {subj_label} does not appear to be {relation_word} {obj_label}.",
        matched_objects=list(subj_ids | obj_ids),
        confidence=0.6,
    )


def execute_objects_on(
    raw_q: str, surface_label: str, objects: list[DetectedObject3D],
    scene_graph: SceneGraphData,
) -> NLQueryResult:
    surfaces = find_objects(surface_label, objects)
    if not surfaces:
        return NLQueryResult(
            query=raw_q,
            answer=f"No {surface_label} detected in the scene.",
            matched_objects=[],
            confidence=0.8,
        )

    surface_ids = {s.track_id for s in surfaces}
    on_items = [
        r for r in scene_graph.relationships
        if r.object_id in surface_ids and r.relation == RelationType.ON
    ]

    if on_items:
        labels = [label_for_id(r.subject_id, objects) for r in on_items]
        ids = [r.subject_id for r in on_items]
        return NLQueryResult(
            query=raw_q,
            answer=f"Objects on the {surface_label}: {', '.join(labels)}.",
            matched_objects=ids,
            confidence=0.8,
        )

    return NLQueryResult(
        query=raw_q,
        answer=f"No objects detected on the {surface_label}.",
        matched_objects=[],
        confidence=0.7,
    )


def execute_describe(
    raw_q: str, objects: list[DetectedObject3D]
) -> NLQueryResult:
    if not objects:
        return NLQueryResult(
            query=raw_q,
            answer="The scene appears empty — no objects detected.",
            matched_objects=[],
            confidence=0.5,
        )
    labels = [f"{o.label} ({o.track_id})" for o in objects]
    return NLQueryResult(
        query=raw_q,
        answer=f"I see {len(objects)} objects: {', '.join(labels)}.",
        matched_objects=[o.track_id for o in objects],
        confidence=0.7,
    )
