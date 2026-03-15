"""ROS2 launch file for the OpenEye perception node."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument("mode", default_value="local",
                              description="Vision mode: local or remote"),
        DeclareLaunchArgument("model", default_value="yolov8",
                              description="Model name for local mode"),
        DeclareLaunchArgument("grpc_address", default_value="localhost:50051",
                              description="gRPC address for remote mode"),
        DeclareLaunchArgument("server_url", default_value="",
                              description="REST URL for remote mode"),
        DeclareLaunchArgument("camera_topic", default_value="/camera/image_raw",
                              description="Input camera topic"),
        DeclareLaunchArgument("frame_id", default_value="camera_link",
                              description="TF frame ID"),

        Node(
            package="openeye_ros2_bridge",
            executable="openeye_perception_node",
            name="openeye_perception",
            output="screen",
            parameters=[{
                "mode": LaunchConfiguration("mode"),
                "model": LaunchConfiguration("model"),
                "grpc_address": LaunchConfiguration("grpc_address"),
                "server_url": LaunchConfiguration("server_url"),
                "camera_topic": LaunchConfiguration("camera_topic"),
                "frame_id": LaunchConfiguration("frame_id"),
            }],
        ),
    ])
