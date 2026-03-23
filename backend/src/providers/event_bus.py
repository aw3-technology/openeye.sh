"""
EventBus - Typed publish/subscribe system for perception events.

Allows components to emit structured events (e.g., DetectionEvent) and
other components (e.g., gRPC service) to subscribe and receive them.
"""

import asyncio
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Deque, Dict, List, Optional

from .singleton import singleton


class EventType(str, Enum):
    DETECTION = "detection"
    SCENE_DESCRIPTION = "scene_description"
    FRAME_CAPTURED = "frame_captured"
    CAMERA_STATUS = "camera_status"
    ERROR = "error"

    # Fleet management events
    DEVICE_REGISTERED = "device_registered"
    DEVICE_STATUS_CHANGED = "device_status_changed"
    DEVICE_HEARTBEAT = "device_heartbeat"
    DEVICE_OFFLINE = "device_offline"
    DEVICE_DECOMMISSIONED = "device_decommissioned"
    DEPLOYMENT_CREATED = "deployment_created"
    DEPLOYMENT_STAGE_ADVANCED = "deployment_stage_advanced"
    DEPLOYMENT_COMPLETED = "deployment_completed"
    DEPLOYMENT_ROLLED_BACK = "deployment_rolled_back"
    DEPLOYMENT_FAILED = "deployment_failed"
    FLEET_ALERT = "fleet_alert"
    OTA_UPDATE_QUEUED = "ota_update_queued"
    MAINTENANCE_WINDOW_STARTED = "maintenance_window_started"


@dataclass
class PerceptionEvent:
    """Base event emitted by the perception pipeline."""

    event_type: EventType
    timestamp: float = field(default_factory=time.time)
    source: str = ""
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DetectionEvent(PerceptionEvent):
    """Structured event for object detections."""

    frame_index: int = 0
    detections: List[Dict[str, Any]] = field(default_factory=list)

    def __post_init__(self):
        self.event_type = EventType.DETECTION


@dataclass
class SceneDescriptionEvent(PerceptionEvent):
    """Structured event for VLM scene descriptions."""

    description: str = ""
    provider: str = ""

    def __post_init__(self):
        self.event_type = EventType.SCENE_DESCRIPTION


@dataclass
class FleetEvent(PerceptionEvent):
    """Event emitted by fleet management operations."""

    device_id: str = ""
    user_id: str = ""
    detail: str = ""

    def __post_init__(self):
        if not self.event_type:
            self.event_type = EventType.DEVICE_STATUS_CHANGED


@dataclass
class DeploymentEvent(PerceptionEvent):
    """Event emitted during deployment lifecycle."""

    deployment_id: str = ""
    model_id: str = ""
    model_version: str = ""
    stage: int = 0

    def __post_init__(self):
        if not self.event_type:
            self.event_type = EventType.DEPLOYMENT_CREATED


@singleton
class EventBus:
    """
    Thread-safe singleton event bus for perception events.

    Supports both sync and async subscribers. For async dispatch from
    non-async threads, call set_event_loop() with the main asyncio loop.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._subscribers: Dict[EventType, List[Callable]] = {}
        self._async_subscribers: Dict[EventType, List[Callable]] = {}
        self._event_history: Deque[PerceptionEvent] = deque(maxlen=1000)
        self._async_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Register the asyncio event loop for async callback dispatch."""
        with self._lock:
            self._async_loop = loop

    def subscribe(self, event_type: EventType, callback: Callable) -> None:
        """Subscribe a sync callback to an event type."""
        with self._lock:
            if event_type not in self._subscribers:
                self._subscribers[event_type] = []
            self._subscribers[event_type].append(callback)
            logging.debug(f"EventBus: subscribed to {event_type.value}")

    def subscribe_async(self, event_type: EventType, callback: Callable) -> None:
        """Subscribe an async callback to an event type."""
        with self._lock:
            if event_type not in self._async_subscribers:
                self._async_subscribers[event_type] = []
            self._async_subscribers[event_type].append(callback)
            logging.debug(f"EventBus: async subscribed to {event_type.value}")

    def unsubscribe(self, event_type: EventType, callback: Callable) -> None:
        """Remove a callback subscription."""
        with self._lock:
            if event_type in self._subscribers:
                self._subscribers[event_type] = [
                    cb for cb in self._subscribers[event_type] if cb != callback
                ]
            if event_type in self._async_subscribers:
                self._async_subscribers[event_type] = [
                    cb for cb in self._async_subscribers[event_type] if cb != callback
                ]

    def publish(self, event: PerceptionEvent) -> None:
        """Publish an event to all subscribers (sync context, thread-safe)."""
        with self._lock:
            self._event_history.append(event)
            sync_cbs = list(self._subscribers.get(event.event_type, []))
            async_cbs = list(self._async_subscribers.get(event.event_type, []))
            loop = self._async_loop

        for cb in sync_cbs:
            try:
                cb(event)
            except Exception as e:
                logging.error(f"EventBus sync callback error: {e}")

        if async_cbs and loop is not None and not loop.is_closed():
            def _on_done(f):
                if f.cancelled():
                    return
                exc = f.exception()
                if exc:
                    logging.error(f"EventBus async callback raised: {exc}")

            for cb in async_cbs:
                try:
                    future = asyncio.run_coroutine_threadsafe(cb(event), loop)
                    future.add_done_callback(_on_done)
                except Exception as e:
                    logging.error(f"EventBus async dispatch error: {e}")

    async def publish_async(self, event: PerceptionEvent) -> None:
        """Publish an event to all subscribers (async context)."""
        with self._lock:
            self._event_history.append(event)
            sync_cbs = list(self._subscribers.get(event.event_type, []))
            async_cbs = list(self._async_subscribers.get(event.event_type, []))

        for cb in sync_cbs:
            try:
                cb(event)
            except Exception as e:
                logging.error(f"EventBus sync callback error: {e}")

        for cb in async_cbs:
            try:
                await cb(event)
            except Exception as e:
                logging.error(f"EventBus async callback error: {e}")

    def get_latest_events(
        self,
        event_type: Optional[EventType] = None,
        limit: int = 50,
    ) -> List[PerceptionEvent]:
        """Get recent events, optionally filtered by type."""
        with self._lock:
            if event_type is not None:
                events = [e for e in self._event_history if e.event_type == event_type]
            else:
                events = list(self._event_history)
            return events[-limit:]

    def clear_history(self) -> None:
        with self._lock:
            self._event_history.clear()
