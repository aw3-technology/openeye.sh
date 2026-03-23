"""Natural language query interface for the perception system.

Story 60: Query the system in natural language and get a structured answer.

Example: "is there a red cup on the table?" → {"answer": "Yes", ...}
"""

from __future__ import annotations

from perception.models import (
    DetectedObject3D,
    NLQueryResult,
    SceneGraphData,
)
from perception.query_parser import parse_query
from perception.query_executor import (
    execute_count,
    execute_existence,
    execute_location,
    execute_relation,
    execute_objects_on,
    execute_describe,
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
        parsed = parse_query(question)

        if parsed.intent == "count":
            return execute_count(parsed.raw, parsed.label, objects)

        if parsed.intent == "existence":
            return execute_existence(parsed.raw, parsed.label, objects, scene_graph)

        if parsed.intent == "location":
            return execute_location(parsed.raw, parsed.label, objects, scene_graph)

        if parsed.intent == "objects_on":
            return execute_objects_on(parsed.raw, parsed.label, objects, scene_graph)

        if parsed.intent == "relation":
            return execute_relation(
                parsed.raw, parsed.subject, parsed.relation_word, parsed.object_label,
                objects, scene_graph,
            )

        return execute_describe(parsed.raw, objects)
