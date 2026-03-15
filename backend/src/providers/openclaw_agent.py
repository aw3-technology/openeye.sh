"""OpenClaw agent — inter-agent communication and safety state broadcasting."""

import asyncio
import logging
import time
from typing import Any, Dict, Optional

from providers.event_bus import (
    DetectionEvent,
    EventBus,
    EventType,
    SceneDescriptionEvent,
)
from providers.singleton import singleton


@singleton
class OpenClawAgent:
    """Singleton agent that monitors perception events and broadcasts safety state."""

    def __init__(self, heartbeat_interval: float = 5.0):
        self._event_bus = EventBus()
        self._heartbeat_interval = heartbeat_interval
        self._running = False
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._latest_detections: list[Dict[str, Any]] = []
        self._latest_scene: str = ""
        self._safety_state: str = "CONTINUE"
        self._risk_level: int = 0

        # Subscribe to events
        self._event_bus.subscribe(EventType.DETECTION, self._on_detection)
        self._event_bus.subscribe(
            EventType.SCENE_DESCRIPTION, self._on_scene
        )

    def _on_detection(self, event: DetectionEvent) -> None:
        """Handle detection events and update internal state."""
        self._latest_detections = event.detections
        # Simple heuristic: if person detected near machinery, raise risk
        labels = [d.get("label", "") for d in event.detections]
        if "person" in labels:
            self._risk_level = max(self._risk_level, 6)
            self._safety_state = "SLOW"
        else:
            self._risk_level = max(0, self._risk_level - 1)
            if self._risk_level < 3:
                self._safety_state = "CONTINUE"

    def _on_scene(self, event: SceneDescriptionEvent) -> None:
        """Handle scene description events."""
        self._latest_scene = event.description

    async def _heartbeat_loop(self) -> None:
        """Periodically broadcast safety state."""
        while self._running:
            try:
                logging.debug(
                    f"OpenClaw heartbeat: state={self._safety_state} "
                    f"risk={self._risk_level} "
                    f"detections={len(self._latest_detections)}"
                )
                await asyncio.sleep(self._heartbeat_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logging.error(f"OpenClaw heartbeat error: {e}")
                await asyncio.sleep(self._heartbeat_interval)

    def send_message(self, target_agent: str, message: Dict[str, Any]) -> None:
        """Send a message to another agent (placeholder for inter-agent comms)."""
        logging.info(f"OpenClaw -> {target_agent}: {message}")

    def get_safety_state(self) -> Dict[str, Any]:
        """Get current safety state."""
        return {
            "safety_state": self._safety_state,
            "risk_level": self._risk_level,
            "detections_count": len(self._latest_detections),
            "latest_scene": self._latest_scene[:200] if self._latest_scene else "",
            "timestamp": time.time(),
        }

    def start(self, loop: Optional[asyncio.AbstractEventLoop] = None) -> None:
        """Start the heartbeat loop."""
        if self._running:
            return
        self._running = True
        target_loop = loop or asyncio.get_event_loop()
        self._heartbeat_task = target_loop.create_task(self._heartbeat_loop())
        logging.info("OpenClaw agent started")

    def stop(self) -> None:
        """Stop the heartbeat loop."""
        self._running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            self._heartbeat_task = None
        logging.info("OpenClaw agent stopped")
