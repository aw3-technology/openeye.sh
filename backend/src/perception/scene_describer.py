"""Scene description and action suggestion generation.

Stories:
  46 - Scene description in unified output
  51 - Action suggestions based on scene + goal
"""

from __future__ import annotations

from perception.models import ActionSuggestion, DetectedObject3D


def label_for_id(track_id: str, objects: list[DetectedObject3D]) -> str:
    """Return the label for a tracked object, or the raw ID if not found."""
    for o in objects:
        if o.track_id == track_id:
            return o.label
    return track_id


def generate_scene_description(
    objects: list[DetectedObject3D],
    relationships: list,
) -> str:
    """Build a natural-language scene summary from objects and relationships."""
    if not objects:
        return "Empty scene."
    labels = [o.label for o in objects]
    counts: dict[str, int] = {}
    for l in labels:
        counts[l] = counts.get(l, 0) + 1
    parts = [f"{c}x {l}" if c > 1 else l for l, c in counts.items()]
    desc = f"Scene contains {', '.join(parts)}."
    if relationships:
        top_rels = relationships[:3]
        rel_strs = []
        for r in top_rels:
            subj_label = label_for_id(r.subject_id, objects)
            obj_label = label_for_id(r.object_id, objects)
            rel_strs.append(f"{subj_label} is {r.relation.value} {obj_label}")
        desc += " " + "; ".join(rel_strs) + "."
    return desc


def suggest_actions(
    objects: list[DetectedObject3D],
    safety_alerts: list,
    robot_goal: str,
) -> list[ActionSuggestion]:
    """Generate action suggestions from safety alerts and goal context."""
    suggestions: list[ActionSuggestion] = []

    for alert in safety_alerts:
        if alert.halt_recommended:
            suggestions.append(ActionSuggestion(
                action="halt",
                target_id=alert.human_track_id,
                reason=alert.message,
                priority=1.0,
            ))
        elif alert.zone.value == "caution":
            suggestions.append(ActionSuggestion(
                action="slow_down",
                target_id=alert.human_track_id,
                reason=alert.message,
                priority=0.8,
            ))

    if robot_goal:
        goal_lower = robot_goal.lower()
        for obj in objects:
            if obj.label.lower() in goal_lower and obj.is_manipulable:
                suggestions.append(ActionSuggestion(
                    action="pick_up",
                    target_id=obj.track_id,
                    reason=f"Object '{obj.label}' matches current goal: {robot_goal}",
                    priority=0.7,
                ))

    return suggestions
