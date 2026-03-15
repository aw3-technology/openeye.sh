"""Converters between PerceptionFrame (Pydantic) and Protobuf messages.

Uses dict-based serialisation so this module works without compiled proto stubs
(same pattern as the existing perception_service.py).
"""

from __future__ import annotations

from typing import Any

from perception.models import (
    ActionSuggestion,
    BBox2D,
    ChangeAlert,
    DetectedObject3D,
    FloorPlane,
    GraspPoint,
    PerceptionFrame,
    Position3D,
    SafetyAlert,
    SafetyZone,
    SceneGraphData,
    SceneGraphNode,
    SpatialRelationship,
)


# ── PerceptionFrame → dict (for gRPC JSON transport) ────────────────


def perception_frame_to_dict(frame: PerceptionFrame) -> dict[str, Any]:
    """Serialise a PerceptionFrame to a JSON-compatible dict for gRPC."""
    return {
        "frame_id": frame.frame_id,
        "timestamp": frame.timestamp,
        "inference_ms": frame.inference_ms,
        "objects": [_obj_to_dict(o) for o in frame.objects],
        "scene_graph": _scene_graph_to_dict(frame.scene_graph),
        "scene_description": frame.scene_description,
        "safety_alerts": [_safety_alert_to_dict(a) for a in frame.safety_alerts],
        "safety_zones": [_safety_zone_to_dict(z) for z in frame.safety_zones],
        "action_suggestions": [_action_to_dict(a) for a in frame.action_suggestions],
        "change_alerts": [_change_to_dict(c) for c in frame.change_alerts],
        "floor_plane": _floor_to_dict(frame.floor_plane) if frame.floor_plane else None,
        "depth_available": frame.depth_available,
    }


def _obj_to_dict(obj: DetectedObject3D) -> dict[str, Any]:
    d: dict[str, Any] = {
        "track_id": obj.track_id,
        "label": obj.label,
        "confidence": obj.confidence,
        "bbox": {"x1": obj.bbox.x1, "y1": obj.bbox.y1, "x2": obj.bbox.x2, "y2": obj.bbox.y2},
        "has_position_3d": obj.position_3d is not None,
        "depth_m": obj.depth_m or 0.0,
        "is_manipulable": obj.is_manipulable,
        "grasp_points": [_grasp_to_dict(g) for g in obj.grasp_points],
    }
    if obj.position_3d:
        d["position_3d"] = {"x": obj.position_3d.x, "y": obj.position_3d.y, "z": obj.position_3d.z}
    return d


def _grasp_to_dict(g: GraspPoint) -> dict[str, Any]:
    return {
        "object_track_id": g.object_track_id,
        "position": {"x": g.position.x, "y": g.position.y, "z": g.position.z},
        "approach_x": g.approach_vector[0],
        "approach_y": g.approach_vector[1],
        "approach_z": g.approach_vector[2],
        "width_m": g.width_m,
        "confidence": g.confidence,
    }


def _scene_graph_to_dict(sg: SceneGraphData) -> dict[str, Any]:
    return {
        "nodes": [
            {
                "track_id": n.track_id,
                "label": n.label,
                "position_3d": (
                    {"x": n.position_3d.x, "y": n.position_3d.y, "z": n.position_3d.z}
                    if n.position_3d
                    else None
                ),
                "has_position_3d": n.position_3d is not None,
                "children": n.children,
            }
            for n in sg.nodes
        ],
        "relationships": [
            {
                "subject_id": r.subject_id,
                "relation": r.relation.value,
                "object_id": r.object_id,
                "confidence": r.confidence,
            }
            for r in sg.relationships
        ],
        "root_id": sg.root_id,
    }


def _safety_alert_to_dict(a: SafetyAlert) -> dict[str, Any]:
    return {
        "human_track_id": a.human_track_id,
        "zone": a.zone.value,
        "distance_m": a.distance_m,
        "message": a.message,
        "halt_recommended": a.halt_recommended,
    }


def _safety_zone_to_dict(z: SafetyZone) -> dict[str, Any]:
    return {
        "human_track_id": z.human_track_id,
        "zone": z.zone.value,
        "distance_m": z.distance_m,
        "bearing_deg": z.bearing_deg,
    }


def _action_to_dict(a: ActionSuggestion) -> dict[str, Any]:
    return {
        "action": a.action,
        "target_id": a.target_id or "",
        "reason": a.reason,
        "priority": a.priority,
    }


def _change_to_dict(c: ChangeAlert) -> dict[str, Any]:
    return {
        "change_type": c.change_type.value,
        "description": c.description,
        "affected_track_ids": c.affected_track_ids,
        "magnitude": c.magnitude,
    }


def _floor_to_dict(f: FloorPlane) -> dict[str, Any]:
    return {
        "nx": f.normal[0],
        "ny": f.normal[1],
        "nz": f.normal[2],
        "height": f.height,
        "confidence": f.confidence,
    }


# ── dict → PerceptionFrame (from gRPC JSON transport) ───────────────


def dict_to_perception_frame(d: dict[str, Any]) -> PerceptionFrame:
    """Deserialise a gRPC dict back into a PerceptionFrame."""
    return PerceptionFrame(
        frame_id=d["frame_id"],
        timestamp=d["timestamp"],
        inference_ms=d["inference_ms"],
        objects=[_dict_to_obj(o) for o in d.get("objects", [])],
        scene_graph=_dict_to_scene_graph(d.get("scene_graph", {})),
        scene_description=d.get("scene_description", ""),
        safety_alerts=[_dict_to_safety_alert(a) for a in d.get("safety_alerts", [])],
        safety_zones=[_dict_to_safety_zone(z) for z in d.get("safety_zones", [])],
        action_suggestions=[_dict_to_action(a) for a in d.get("action_suggestions", [])],
        change_alerts=[_dict_to_change(c) for c in d.get("change_alerts", [])],
        floor_plane=_dict_to_floor(d["floor_plane"]) if d.get("floor_plane") else None,
        depth_available=d.get("depth_available", False),
    )


# Alias for use from client.py
proto_to_perception_frame = dict_to_perception_frame


def _dict_to_obj(d: dict[str, Any]) -> DetectedObject3D:
    pos = None
    if d.get("has_position_3d") and d.get("position_3d"):
        p = d["position_3d"]
        pos = Position3D(x=p["x"], y=p["y"], z=p["z"])
    return DetectedObject3D(
        track_id=d["track_id"],
        label=d["label"],
        confidence=d["confidence"],
        bbox=BBox2D(**d["bbox"]),
        position_3d=pos,
        depth_m=d.get("depth_m"),
        is_manipulable=d.get("is_manipulable", False),
        grasp_points=[_dict_to_grasp(g) for g in d.get("grasp_points", [])],
    )


def _dict_to_grasp(d: dict[str, Any]) -> GraspPoint:
    p = d["position"]
    return GraspPoint(
        object_track_id=d["object_track_id"],
        position=Position3D(x=p["x"], y=p["y"], z=p["z"]),
        approach_vector=(d["approach_x"], d["approach_y"], d["approach_z"]),
        width_m=d["width_m"],
        confidence=d["confidence"],
    )


def _dict_to_scene_graph(d: dict[str, Any]) -> SceneGraphData:
    if not d:
        return SceneGraphData()
    nodes = []
    for n in d.get("nodes", []):
        pos = None
        if n.get("has_position_3d") and n.get("position_3d"):
            p = n["position_3d"]
            pos = Position3D(x=p["x"], y=p["y"], z=p["z"])
        nodes.append(
            SceneGraphNode(
                track_id=n["track_id"],
                label=n["label"],
                position_3d=pos,
                children=n.get("children", []),
            )
        )
    rels = [
        SpatialRelationship(
            subject_id=r["subject_id"],
            relation=r["relation"],
            object_id=r["object_id"],
            confidence=r["confidence"],
        )
        for r in d.get("relationships", [])
    ]
    return SceneGraphData(nodes=nodes, relationships=rels, root_id=d.get("root_id", "scene_root"))


def _dict_to_safety_alert(d: dict[str, Any]) -> SafetyAlert:
    return SafetyAlert(
        human_track_id=d["human_track_id"],
        zone=d["zone"],
        distance_m=d["distance_m"],
        message=d["message"],
        halt_recommended=d.get("halt_recommended", False),
    )


def _dict_to_safety_zone(d: dict[str, Any]) -> SafetyZone:
    return SafetyZone(
        human_track_id=d["human_track_id"],
        zone=d["zone"],
        distance_m=d["distance_m"],
        bearing_deg=d["bearing_deg"],
    )


def _dict_to_action(d: dict[str, Any]) -> ActionSuggestion:
    return ActionSuggestion(
        action=d["action"],
        target_id=d.get("target_id") or None,
        reason=d["reason"],
        priority=d["priority"],
    )


def _dict_to_change(d: dict[str, Any]) -> ChangeAlert:
    return ChangeAlert(
        change_type=d["change_type"],
        description=d["description"],
        affected_track_ids=d.get("affected_track_ids", []),
        magnitude=d["magnitude"],
    )


def _dict_to_floor(d: dict[str, Any]) -> FloorPlane:
    return FloorPlane(
        normal=(d["nx"], d["ny"], d["nz"]),
        height=d["height"],
        confidence=d["confidence"],
    )
