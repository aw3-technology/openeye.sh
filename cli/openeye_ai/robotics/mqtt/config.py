"""MQTT broker configuration."""

from __future__ import annotations

from urllib.parse import urlparse

from pydantic import BaseModel, Field


class MQTTConfig(BaseModel):
    """Configuration for the MQTT perception transport."""

    broker_url: str = Field(
        default="mqtt://localhost:1883",
        description="MQTT broker URL (mqtt:// or mqtts://)",
    )
    robot_id: str = Field(
        default="robot-01",
        description="Robot identifier used in topic hierarchy",
    )
    client_id: str = Field(
        default="",
        description="MQTT client ID (auto-generated if empty)",
    )
    username: str = Field(default="", description="Broker username")
    password: str = Field(default="", description="Broker password")

    # QoS settings
    qos_detections: int = Field(
        default=0,
        description="QoS for high-frequency detection topics (0 = fire-and-forget)",
    )
    qos_safety: int = Field(
        default=1,
        description="QoS for safety-critical topics (1 = at-least-once)",
    )
    qos_control: int = Field(
        default=1,
        description="QoS for control topics",
    )

    @property
    def broker_host(self) -> str:
        parsed = urlparse(self.broker_url)
        return parsed.hostname or "localhost"

    @property
    def broker_port(self) -> int:
        parsed = urlparse(self.broker_url)
        return parsed.port or 1883

    @property
    def use_tls(self) -> bool:
        return self.broker_url.startswith("mqtts://")

    def topic(self, suffix: str) -> str:
        """Build a topic string: ``openeye/{robot_id}/{suffix}``."""
        return f"openeye/{self.robot_id}/{suffix}"


# Standard topic suffixes
TOPIC_FRAME = "perception/frame"
TOPIC_DETECTIONS = "perception/detections"
TOPIC_SAFETY = "perception/safety"
TOPIC_SCENE_GRAPH = "perception/scene_graph"
TOPIC_GRASP_POINTS = "perception/grasp_points"
TOPIC_CONTROL_GOAL = "control/goal"
