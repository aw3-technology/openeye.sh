"""ROS2 perception node — bridges OpenEye vision to ROS2 topics.

Supports two modes:
  - **local**: Imports ``RobotVision`` directly, runs inference on-node.
  - **remote**: Connects via gRPC to a remote OpenEye server.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from std_msgs.msg import String
from vision_msgs.msg import Detection3DArray

logger = logging.getLogger(__name__)


class OpenEyePerceptionNode(Node):
    """ROS2 node that publishes OpenEye perception results.

    Published topics::

        /openeye/detections       (vision_msgs/Detection3DArray)
        /openeye/scene_description (std_msgs/String)
        /openeye/safety           (std_msgs/String — JSON)
        /openeye/scene_graph      (std_msgs/String — JSON)
        /openeye/grasp_points     (std_msgs/String — JSON)
        /openeye/floor_plane      (shape_msgs/Plane)

    Subscribed topics::

        /camera/image_raw         (sensor_msgs/Image)
        /openeye/goal             (std_msgs/String)
    """

    def __init__(self) -> None:
        super().__init__("openeye_perception")

        # Parameters
        self.declare_parameter("mode", "local")  # "local" or "remote"
        self.declare_parameter("model", "yolov8")
        self.declare_parameter("grpc_address", "localhost:50051")
        self.declare_parameter("server_url", "")
        self.declare_parameter("camera_topic", "/camera/image_raw")
        self.declare_parameter("frame_id", "camera_link")
        self.declare_parameter("publish_rate", 30.0)

        self._mode = self.get_parameter("mode").value
        self._frame_id = self.get_parameter("frame_id").value

        # Publishers
        self._pub_detections = self.create_publisher(
            Detection3DArray, "/openeye/detections", 10
        )
        self._pub_description = self.create_publisher(
            String, "/openeye/scene_description", 10
        )
        self._pub_safety = self.create_publisher(
            String, "/openeye/safety", 10
        )
        self._pub_scene_graph = self.create_publisher(
            String, "/openeye/scene_graph", 10
        )
        self._pub_grasp = self.create_publisher(
            String, "/openeye/grasp_points", 10
        )

        # Subscribers
        camera_topic = self.get_parameter("camera_topic").value
        self._sub_camera = self.create_subscription(
            Image, camera_topic, self._on_image, 10
        )
        self._sub_goal = self.create_subscription(
            String, "/openeye/goal", self._on_goal, 10
        )

        # Vision backend
        self._vision: Any = None
        self._remote_client: Any = None
        self._init_vision()

        self.get_logger().info(
            f"OpenEye perception node started (mode={self._mode})"
        )

    def _init_vision(self) -> None:
        """Initialise vision backend based on mode."""
        if self._mode == "local":
            from openeye_ai.robotics import RobotVision, RobotVisionConfig

            model = self.get_parameter("model").value
            config = RobotVisionConfig(mode="server", model=model)
            self._vision = RobotVision(config)
            self._vision.start()
            self.get_logger().info(f"Local vision started (model={model})")

        elif self._mode == "remote":
            from openeye_ai.robotics.client import RemoteVisionClient

            grpc_addr = self.get_parameter("grpc_address").value
            server_url = self.get_parameter("server_url").value
            self._remote_client = RemoteVisionClient(
                grpc_address=grpc_addr if grpc_addr else None,
                server_url=server_url if server_url else None,
            )
            self._remote_client.connect()
            self.get_logger().info(f"Remote vision connected")

    def _on_image(self, msg: Image) -> None:
        """Process an incoming camera image."""
        import numpy as np

        from openeye_ros2_bridge.msg_converters import (
            grasp_points_to_json_msg,
            perception_frame_to_ros2_msgs,
            safety_alerts_to_json_msg,
            scene_graph_to_json_msg,
        )

        # Convert ROS2 Image to numpy
        frame = np.frombuffer(msg.data, dtype=np.uint8).reshape(
            msg.height, msg.width, -1
        )
        # Handle BGR → RGB if needed
        if msg.encoding == "bgr8":
            frame = frame[:, :, ::-1].copy()

        # Run perception
        if self._vision is not None:
            result = self._vision.perceive(frame)
            frame_dict = result.model_dump(mode="json")
        elif self._remote_client is not None:
            result = self._remote_client.perceive(frame)
            frame_dict = result.model_dump(mode="json") if hasattr(result, "model_dump") else result
        else:
            return

        stamp = msg.header.stamp

        # Publish standard ROS2 messages
        ros2_msgs = perception_frame_to_ros2_msgs(
            frame_dict, stamp=stamp, frame_id=self._frame_id
        )

        if "detections" in ros2_msgs:
            self._pub_detections.publish(ros2_msgs["detections"])
        if "scene_description" in ros2_msgs:
            self._pub_description.publish(ros2_msgs["scene_description"])

        # Publish JSON-encoded custom messages
        self._pub_safety.publish(safety_alerts_to_json_msg(frame_dict))
        self._pub_scene_graph.publish(scene_graph_to_json_msg(frame_dict))
        self._pub_grasp.publish(grasp_points_to_json_msg(frame_dict))

    def _on_goal(self, msg: String) -> None:
        """Handle goal updates."""
        if self._vision is not None:
            self._vision.set_goal(msg.data)
            self.get_logger().info(f"Goal updated: {msg.data}")

    def destroy_node(self) -> None:
        if self._vision is not None:
            self._vision.stop()
        if self._remote_client is not None:
            self._remote_client.close()
        super().destroy_node()


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = OpenEyePerceptionNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
