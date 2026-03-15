"""
TelemetryProvider - Structured telemetry for the perception runtime.

Tracks per-frame latency, model load time, errors, and exposes
metrics for monitoring and debugging.
"""

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional

from .singleton import singleton


@dataclass
class FrameTelemetry:
    """Telemetry for a single frame processing cycle."""

    frame_index: int
    timestamp: float
    capture_ms: float = 0.0
    inference_ms: float = 0.0
    total_ms: float = 0.0
    num_detections: int = 0
    source: str = ""


@dataclass
class ErrorRecord:
    """A recorded error event."""

    timestamp: float
    source: str
    error_type: str
    message: str


@singleton
class TelemetryProvider:
    """
    Singleton provider for structured telemetry data.

    Tracks:
    - Per-frame latency (capture, inference, total)
    - Model load time
    - Error counts and history
    - FPS metrics
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._frame_history: Deque[FrameTelemetry] = deque(maxlen=1000)
        self._error_history: Deque[ErrorRecord] = deque(maxlen=500)
        self._model_load_times: Dict[str, float] = {}
        self._counters: Dict[str, int] = {
            "frames_processed": 0,
            "detections_total": 0,
            "errors_total": 0,
            "camera_reconnects": 0,
        }
        self._start_time: float = time.time()
        self._fps_window: Deque[float] = deque(maxlen=100)

    def record_frame(self, telemetry: FrameTelemetry) -> None:
        """Record telemetry for a processed frame."""
        with self._lock:
            self._frame_history.append(telemetry)
            self._counters["frames_processed"] += 1
            self._counters["detections_total"] += telemetry.num_detections
            self._fps_window.append(telemetry.timestamp)

        logging.debug(
            f"[telemetry] frame={telemetry.frame_index} "
            f"capture={telemetry.capture_ms:.1f}ms "
            f"inference={telemetry.inference_ms:.1f}ms "
            f"total={telemetry.total_ms:.1f}ms "
            f"detections={telemetry.num_detections}"
        )

    def record_model_load(self, model_name: str, load_time_ms: float) -> None:
        """Record model load time."""
        with self._lock:
            self._model_load_times[model_name] = load_time_ms
        logging.info(f"[telemetry] model_load={model_name} time={load_time_ms:.1f}ms")

    def record_error(self, source: str, error_type: str, message: str) -> None:
        """Record an error event."""
        record = ErrorRecord(
            timestamp=time.time(),
            source=source,
            error_type=error_type,
            message=message,
        )
        with self._lock:
            self._error_history.append(record)
            self._counters["errors_total"] += 1
        logging.warning(f"[telemetry] error source={source} type={error_type}: {message}")

    def record_camera_reconnect(self) -> None:
        """Record a camera reconnect event."""
        with self._lock:
            self._counters["camera_reconnects"] += 1
        logging.info("[telemetry] camera_reconnect")

    def increment_counter(self, name: str, amount: int = 1) -> None:
        with self._lock:
            self._counters[name] = self._counters.get(name, 0) + amount

    def _get_current_fps_unlocked(self) -> float:
        """Calculate FPS. Must be called with self._lock held."""
        if len(self._fps_window) < 2:
            return 0.0
        elapsed = self._fps_window[-1] - self._fps_window[0]
        if elapsed <= 0:
            return 0.0
        return (len(self._fps_window) - 1) / elapsed

    def get_current_fps(self) -> float:
        """Calculate current FPS from recent frame timestamps."""
        with self._lock:
            return self._get_current_fps_unlocked()

    def _get_avg_latency_unlocked(self, window: int = 50) -> Dict[str, float]:
        """Calculate avg latency. Must be called with self._lock held."""
        frames = list(self._frame_history)[-window:]
        if not frames:
            return {"capture_ms": 0.0, "inference_ms": 0.0, "total_ms": 0.0}
        count = len(frames)
        return {
            "capture_ms": sum(f.capture_ms for f in frames) / count,
            "inference_ms": sum(f.inference_ms for f in frames) / count,
            "total_ms": sum(f.total_ms for f in frames) / count,
        }

    def get_avg_latency(self, window: int = 50) -> Dict[str, float]:
        """Get average latency metrics over recent frames."""
        with self._lock:
            return self._get_avg_latency_unlocked(window)

    def get_metrics(self) -> Dict[str, Any]:
        """Get a complete, consistent telemetry snapshot."""
        with self._lock:
            uptime = time.time() - self._start_time
            fps = self._get_current_fps_unlocked()
            avg_latency = self._get_avg_latency_unlocked()
            counters = dict(self._counters)
            model_loads = dict(self._model_load_times)
            recent_errors = [
                {
                    "timestamp": e.timestamp,
                    "source": e.source,
                    "error_type": e.error_type,
                    "message": e.message,
                }
                for e in list(self._error_history)[-10:]
            ]
        return {
            "uptime_seconds": uptime,
            "current_fps": fps,
            "avg_latency": avg_latency,
            "counters": counters,
            "model_load_times": model_loads,
            "recent_errors": recent_errors,
        }

    def get_recent_frames(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent frame telemetry as dicts."""
        with self._lock:
            frames = list(self._frame_history)[-limit:]
        return [
            {
                "frame_index": f.frame_index,
                "timestamp": f.timestamp,
                "capture_ms": f.capture_ms,
                "inference_ms": f.inference_ms,
                "total_ms": f.total_ms,
                "num_detections": f.num_detections,
                "source": f.source,
            }
            for f in frames
        ]
