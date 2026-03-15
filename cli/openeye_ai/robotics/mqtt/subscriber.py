"""MQTT subscriber — receives PerceptionFrame data from MQTT topics."""

from __future__ import annotations

import json
import logging
import queue
import uuid
from typing import Any, Generator

from openeye_ai.robotics.mqtt.config import (
    TOPIC_CONTROL_GOAL,
    TOPIC_DETECTIONS,
    TOPIC_FRAME,
    TOPIC_GRASP_POINTS,
    TOPIC_SAFETY,
    TOPIC_SCENE_GRAPH,
    MQTTConfig,
)

logger = logging.getLogger(__name__)


class MQTTPerceptionSubscriber:
    """Subscribes to MQTT perception topics and yields frames.

    Usage::

        sub = MQTTPerceptionSubscriber(config)
        sub.connect()
        for frame_dict in sub.frames():
            print(frame_dict["objects"])
        sub.disconnect()
    """

    def __init__(self, config: MQTTConfig) -> None:
        self._config = config
        self._client: Any = None
        self._queue: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=200)
        self._goal_callback: Any = None

    def connect(self, topics: list[str] | None = None) -> None:
        """Connect and subscribe to perception topics.

        Parameters
        ----------
        topics : list[str], optional
            Topic suffixes to subscribe to. Defaults to all perception topics.
        """
        import paho.mqtt.client as mqtt

        client_id = self._config.client_id or f"openeye-sub-{uuid.uuid4().hex[:8]}"
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

        self._client.on_message = self._on_message

        suffixes = topics or [
            TOPIC_FRAME,
            TOPIC_DETECTIONS,
            TOPIC_SAFETY,
            TOPIC_SCENE_GRAPH,
            TOPIC_GRASP_POINTS,
        ]

        self._client.connect(self._config.broker_host, self._config.broker_port)

        for suffix in suffixes:
            topic = self._config.topic(suffix)
            self._client.subscribe(topic, qos=self._config.qos_detections)
            logger.debug("Subscribed to %s", topic)

        self._client.loop_start()
        logger.info(
            "MQTT subscriber connected to %s:%d",
            self._config.broker_host,
            self._config.broker_port,
        )

    def disconnect(self) -> None:
        """Disconnect from the broker."""
        if self._client is not None:
            self._client.loop_stop()
            self._client.disconnect()
            self._client = None

    def on_goal(self, callback: Any) -> None:
        """Register a callback for goal updates on the control topic.

        The callback receives a single ``str`` argument (the goal text).
        """
        self._goal_callback = callback
        if self._client is not None:
            topic = self._config.topic(TOPIC_CONTROL_GOAL)
            self._client.subscribe(topic, qos=self._config.qos_control)

    def frames(self, timeout: float = 1.0) -> Generator[dict[str, Any], None, None]:
        """Yield perception frame dicts as they arrive.

        Parameters
        ----------
        timeout : float
            Seconds to wait for each message before checking again.
        """
        while True:
            try:
                msg = self._queue.get(timeout=timeout)
                yield msg
            except queue.Empty:
                continue

    def get(self, timeout: float = 5.0) -> dict[str, Any] | None:
        """Get a single message, or ``None`` on timeout."""
        try:
            return self._queue.get(timeout=timeout)
        except queue.Empty:
            return None

    # ── Internal ─────────────────────────────────────────────────────

    def _on_message(self, client: Any, userdata: Any, msg: Any) -> None:
        try:
            payload = json.loads(msg.payload)
        except (json.JSONDecodeError, UnicodeDecodeError):
            logger.warning("Invalid MQTT payload on %s", msg.topic)
            return

        # Check if this is a goal control message
        if msg.topic.endswith(TOPIC_CONTROL_GOAL):
            if self._goal_callback and isinstance(payload, dict):
                self._goal_callback(payload.get("goal", ""))
            return

        # Enqueue perception data
        try:
            self._queue.put_nowait({"topic": msg.topic, **payload})
        except queue.Full:
            # Drop oldest to keep up
            try:
                self._queue.get_nowait()
                self._queue.put_nowait({"topic": msg.topic, **payload})
            except queue.Empty:
                pass
