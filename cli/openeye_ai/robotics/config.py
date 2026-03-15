"""Configuration for the robotics vision SDK."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

class DeploymentMode(str, Enum):
    """Deployment topology for the vision pipeline."""

    EDGE = "edge"  # Lightweight YOLO only — runs on-robot (e.g. Jetson)
    SERVER = "server"  # Full pipeline + VLM — runs on a beefy server
    REMOTE = "remote"  # gRPC/REST client — pipeline runs elsewhere

class RobotVisionConfig(BaseModel):
    """Configuration for :class:`RobotVision`."""

    # Deployment
    mode: DeploymentMode = Field(
        default=DeploymentMode.SERVER,
        description="Where the pipeline runs: edge, server, or remote",
    )
    model: str = Field(
        default="yolov8",
        description="Model name from the OpenEye registry",
    )
    variant: str | None = Field(
        default=None,
        description="Model variant (e.g. 'onnx', 'tensorrt')",
    )

    # Pipeline feature toggles
    depth_enabled: bool = Field(default=False, description="Enable depth estimation")
    vlm_enabled: bool = Field(default=False, description="Enable VLM reasoning")
    safety_enabled: bool = Field(default=True, description="Enable safety guardian")
    tracking_enabled: bool = Field(default=True, description="Enable object tracking")
    scene_graph_enabled: bool = Field(default=True, description="Enable scene graph")
    grasp_points_enabled: bool = Field(default=True, description="Enable grasp points")

    # Safety zone radii (metres)
    danger_m: float = Field(default=0.5, description="Danger zone radius in metres")
    caution_m: float = Field(default=1.5, description="Caution zone radius in metres")

    # Remote mode connection
    server_url: str | None = Field(
        default=None,
        description="REST server URL for remote mode (e.g. http://host:8000)",
    )
    grpc_address: str | None = Field(
        default=None,
        description="gRPC server address for remote mode (e.g. host:50051)",
    )
