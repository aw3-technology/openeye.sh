"""Natural language query interface for the perception system.

Story 60: Query the system in natural language and get a structured answer.

Example: "is there a red cup on the table?" → {"answer": "Yes", ...}
"""

from __future__ import annotations

import re
from typing import Optional

from perception.models import (
    DetectedObject3D,
    NLQueryResult,
    RelationType,
    SceneGraphData,
    SpatialRelationship,
)


class PerceptionQueryEngine:
    """Answer natural-language questions about the current scene.

    Handles common patterns:
      - "is there a <object>?"
      - "where is the <object>?"
      - "how many <object>s are there?"
      - "is <objectA> on/near <objectB>?"
      - "what objects are on the <surface>?"
    """

    def query(
        self,
        question: str,
        objects: list[DetectedObject3D],
        scene_graph: SceneGraphData,
    ) -> NLQueryResult:
        q = question.strip().lower().rstrip("?").strip()

        # "how many"
        m = re.match(r"how many (.+?)s?\s+(are|do|is)\s+(there|you see)", q)
        if m:
            return self._count_query(question, m.group(1).strip(), objects)

        # Simple "how many objects"
        m = re.match(r"how many (.+)", q)
        if m:
            return self._count_query(question, m.group(1).strip().rstrip("s"), objects)

        # "is there a ..."
        m = re.match(r"(?:is|are) there (?:a |an |any |the )?(.+)", q)
        if m:
            return self._existence_query(question, m.group(1).strip(), objects, scene_graph)

        # "where is the ..."
        m = re.match(r"where (?:is|are) (?:the |a )?(.+)", q)
        if m:
            return self._location_query(question, m.group(1).strip(), objects, scene_graph)

        # "what objects are on the ..."
        m = re.match(r"what (?:objects?|things?|items?) (?:are|is) (?:on|near|above|below) (?:the )?(.+)", q)
        if m:
            return self._objects_on_query(question, m.group(1).strip(), objects, scene_graph)

        # "is <A> on/near <B>"
        m = re.match(
            r"is (?:the |a )?(.+?) (on|near|above|below|left of|right of|next to|in front of|behind) (?:the |a )?(.+)",
            q,
        )
        if m:
            return self._relation_query(
                question, m.group(1).strip(), m.group(2).strip(), m.group(3).strip(),
                objects, scene_graph,
            )

        # Fallback: list all objects
        return self._describe_scene(question, objects)

    def _find_objects(self, label_query: str, objects: list[DetectedObject3D]) -> list[DetectedObject3D]:
        """Find objects matching a label query (supports colour hints)."""
        parts = label_query.split()
        # Last word is typically the object class
        target_label = parts[-1] if parts else label_query
        return [
            o for o in objects
            if target_label in o.label.lower() or o.label.lower() in target_label
        ]

    def _count_query(
        self, raw_q: str, label: str, objects: list[DetectedObject3D]
    ) -> NLQueryResult:
        # "objects" / "things" / "items" → count all
        if label in ("object", "thing", "item"):
            count = len(objects)
            return NLQueryResult(
                query=raw_q,
                answer=f"There {'is' if count == 1 else 'are'} {count} object{'s' if count != 1 else ''} in the scene.",
                matched_objects=[o.track_id for o in objects],
                confidence=0.9,
            )
        matches = self._find_objects(label, objects)
        count = len(matches)
        word = label if count == 1 else f"{label}s"
        return NLQueryResult(
            query=raw_q,
            answer=f"There {'is' if count == 1 else 'are'} {count} {word} in the scene.",
            matched_objects=[m.track_id for m in matches],
            confidence=0.9 if matches else 0.7,
        )

    def _existence_query(
        self, raw_q: str, desc: str, objects: list[DetectedObject3D],
        scene_graph: SceneGraphData,
    ) -> NLQueryResult:
        # Check for relational queries like "a cup on the table"
        rel_match = re.match(
            r"(.+?) (on|near|above|below) (?:the |a )?(.+)", desc
        )
        if rel_match:
            return self._relation_query(
                raw_q,
                rel_match.group(1).strip(),
                rel_match.group(2).strip(),
                rel_match.group(3).strip(),
                objects, scene_graph,
            )

        matches = self._find_objects(desc, objects)
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

    def _location_query(
        self, raw_q: str, label: str, objects: list[DetectedObject3D],
        scene_graph: SceneGraphData,
    ) -> NLQueryResult:
        matches = self._find_objects(label, objects)
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

        # Add spatial relationships
        for rel in scene_graph.relationships:
            if rel.subject_id in [m.track_id for m in matches]:
                target_label = self._label_for_id(rel.object_id, objects)
                descriptions.append(
                    f"  → {rel.relation.value} {target_label}"
                )

        return NLQueryResult(
            query=raw_q,
            answer="; ".join(descriptions) + ".",
            matched_objects=[m.track_id for m in matches],
            confidence=0.85,
        )

    def _relation_query(
        self, raw_q: str, subj_label: str, relation_word: str, obj_label: str,
        objects: list[DetectedObject3D], scene_graph: SceneGraphData,
    ) -> NLQueryResult:
        subj_matches = self._find_objects(subj_label, objects)
        obj_matches = self._find_objects(obj_label, objects)

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

    def _objects_on_query(
        self, raw_q: str, surface_label: str, objects: list[DetectedObject3D],
        scene_graph: SceneGraphData,
    ) -> NLQueryResult:
        surfaces = self._find_objects(surface_label, objects)
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
            labels = [self._label_for_id(r.subject_id, objects) for r in on_items]
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

    def _describe_scene(
        self, raw_q: str, objects: list[DetectedObject3D]
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

    @staticmethod
    def _label_for_id(track_id: str, objects: list[DetectedObject3D]) -> str:
        for o in objects:
            if o.track_id == track_id:
                return o.label
        return track_id
