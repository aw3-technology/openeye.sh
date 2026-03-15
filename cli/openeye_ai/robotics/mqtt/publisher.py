"""MQTT publisher — streams PerceptionFrame data to MQTT topics."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from openeye_ai.robotics.mqtt.config import (
    TOPIC_DETECTIONS,
    TOPIC_FRAME,
    TOPIC_GRASP_POINTS,
    TOPIC_SAFETY,
    TOPIC_SCENE_GRAPH,
    MQTTConfig,
)

logger = logging.getLogger(__name__)


class MQTTPerceptionPublisher:
    """Publishes PerceptionFrame data to MQTT topics.

    Topic structure::

        openeye/{robot_id}/perception/frame          # Full frame JSON
        openeye/{robot_id}/perception/detections      # Objects only
        openeye/{robot_id}/perception/safety           # Safety alerts + zones
        openeye/{robot_id}/perception/scene_graph      # Scene graph
        openeye/{robot_id}/perception/grasp_points     # Grasp points
    """

    def __init__(self, config: MQTTConfig) -> None:
        self._config = config
        self._client: Any = None

    def connect(self) -> None:
        """Connect to the MQTT broker."""
        import paho.mqtt.client as mqtt

        client_id = self._config.client_id or f"openeye-pub-{uuid.uuid4().hex[:8]}"
        self._client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=client_id,
        )

        if self._config.username:
            self._client.username_pw_set(
                self._config.username, self._config.password
            )
        if self._config.use_tls:
            self._client.tls_set()

        self._client.connect(self._config.broker_host, self._config.broker_port)
        self._client.loop_start()
        logger.info(
            "MQTT publisher connected to %s:%d (robot_id=%s)",
            self._config.broker_host,
            self._config.broker_port,
            self._config.robot_id,
        )

    def disconnect(self) -> None:
        """Disconnect from the broker."""
        if self._client is not None:
            self._client.loop_stop()
            self._client.disconnect()
            self._client = None

    def publish_frame(self, frame_dict: dict[str, Any]) -> None:
        """Publish a full PerceptionFrame (as dict) to all relevant topics.

        Parameters
        ----------
        frame_dict : dict
            A PerceptionFrame serialised via
            ``perception_grpc.converters.perception_frame_to_dict`` or
            ``PerceptionFrame.model_dump(mode='json')``.
        """
        if self._client is None:
            raise RuntimeError("Not connected. Call connect() first.")

        cfg = self._config

        # Full frame
        self._publish(
            cfg.topic(TOPIC_FRAME),
            frame_dict,
            qos=cfg.qos_detections,
        )

        # Detections only
        if frame_dict.get("objects"):
            self._publish(
                cfg.topic(TOPIC_DETECTIONS),
                {"frame_id": frame_dict.get("frame_id"), "objects": frame_dict["objects"]},
                qos=cfg.qos_detections,
            )

        # Safety
        if frame_dict.get("safety_alerts") or frame_dict.get("safety_zones"):
            self._publish(
                cfg.topic(TOPIC_SAFETY),
                {
                    "frame_id": frame_dict.get("frame_id"),
                    "safety_alerts": frame_dict.get("safety_alerts", []),
                    "safety_zones": frame_dict.get("safety_zones", []),
                },
                qos=cfg.qos_safety,
            )

        # Scene graph
        if frame_dict.get("scene_graph"):
            self._publish(
                cfg.topic(TOPIC_SCENE_GRAPH),
                {"frame_id": frame_dict.get("frame_id"), "scene_graph": frame_dict["scene_graph"]},
                qos=cfg.qos_detections,
            )

        # Grasp points
        grasp_points = []
        for obj in frame_dict.get("objects", []):
            grasp_points.extend(obj.get("grasp_points", []))
        if grasp_points:
            self._publish(
                cfg.topic(TOPIC_GRASP_POINTS),
                {"frame_id": frame_dict.get("frame_id"), "grasp_points": grasp_points},
                qos=cfg.qos_detections,
            )

    def _publish(self, topic: str, payload: dict, qos: int = 0) -> None:
        self._client.publish(topic, json.dumps(payload), qos=qos)
