"""Convert OpenEye PerceptionFrame data to ROS2 message types.

Standard ROS2 message mappings:
  DetectedObject3D  → vision_msgs/Detection3DArray
  Position3D        → geometry_msgs/Point
  FloorPlane        → shape_msgs/Plane
  SafetyAlert       → openeye_msgs/SafetyAlert  (custom)
  SceneGraphData    → openeye_msgs/SceneGraph    (custom)
  GraspPoint        → openeye_msgs/GraspPoint    (custom)
"""

from __future__ import annotations

from typing import Any


def perception_frame_to_ros2_msgs(
    frame_dict: dict[str, Any],
    stamp: Any = None,
    frame_id: str = "camera_link",
) -> dict[str, Any]:
    """Convert a PerceptionFrame dict to a dict of ROS2 messages.

    Parameters
    ----------
    frame_dict : dict
        Serialised PerceptionFrame.
    stamp : rclpy.time.Time, optional
        ROS2 timestamp. Uses ``now()`` if not provided.
    frame_id : str
        TF frame ID for the header.

    Returns
    -------
    dict[str, Any]
        Keys are topic suffixes, values are ROS2 message instances.
    """
    from builtin_interfaces.msg import Time
    from geometry_msgs.msg import Point
    from shape_msgs.msg import Plane
    from std_msgs.msg import Header
    from vision_msgs.msg import (
        BoundingBox3D,
        Detection3D,
        Detection3DArray,
        ObjectHypothesisWithPose,
    )

    header = Header(frame_id=frame_id)
    if stamp is not None:
        header.stamp = stamp

    msgs: dict[str, Any] = {}

    # ── Detections → Detection3DArray ───────────────────────────────
    det_array = Detection3DArray(header=header)
    for obj in frame_dict.get("objects", []):
        hyp = ObjectHypothesisWithPose()
        hyp.hypothesis.class_id = obj["label"]
        hyp.hypothesis.score = obj["confidence"]

        det = Detection3D()
        det.results.append(hyp)
        det.id = obj["track_id"]

        if obj.get("has_position_3d") and obj.get("position_3d"):
            p = obj["position_3d"]
            det.bbox.center.position = Point(x=p["x"], y=p["y"], z=p["z"])

        det_array.detections.append(det)
    msgs["detections"] = det_array

    # ── Floor plane → Plane ────────────────────────────────────────
    fp = frame_dict.get("floor_plane")
    if fp:
        plane = Plane()
        plane.coef = [fp["nx"], fp["ny"], fp["nz"], fp["height"]]
        msgs["floor_plane"] = plane

    # ── Scene description → String ─────────────────────────────────
    from std_msgs.msg import String

    desc = frame_dict.get("scene_description", "")
    msgs["scene_description"] = String(data=desc)

    return msgs


def safety_alerts_to_json_msg(frame_dict: dict[str, Any]) -> Any:
    """Pack safety alerts as a JSON String message (custom msg fallback)."""
    import json

    from std_msgs.msg import String

    data = {
        "safety_alerts": frame_dict.get("safety_alerts", []),
        "safety_zones": frame_dict.get("safety_zones", []),
    }
    return String(data=json.dumps(data))


def scene_graph_to_json_msg(frame_dict: dict[str, Any]) -> Any:
    """Pack scene graph as a JSON String message (custom msg fallback)."""
    import json

    from std_msgs.msg import String

    return String(data=json.dumps(frame_dict.get("scene_graph", {})))


def grasp_points_to_json_msg(frame_dict: dict[str, Any]) -> Any:
    """Pack grasp points as a JSON String message."""
    import json

    from std_msgs.msg import String

    points: list[dict] = []
    for obj in frame_dict.get("objects", []):
        points.extend(obj.get("grasp_points", []))
    return String(data=json.dumps(points))
