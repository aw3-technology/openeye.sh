"""
gRPC Perception Service - Low-latency streaming for robot controllers.

Subscribes to the EventBus for detection events and streams them
over gRPC to connected robot controllers.

Usage:
    Generate Python stubs from the .proto file:
        python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. perception.proto

    Or use the built-in reflection-free server below.
"""

import json
import logging
import queue
import threading
import time
from concurrent import futures
from typing import Dict, List, Optional

try:
    import grpc

    _GRPC_AVAILABLE = True
except ImportError:
    grpc = None  # type: ignore[assignment]
    _GRPC_AVAILABLE = False

from providers.event_bus import DetectionEvent, EventBus, EventType
from providers.telemetry_provider import TelemetryProvider


# --- In-memory proto message builders (avoids requiring codegen) ---


class _DetectionMsg:
    """Lightweight detection message for gRPC serialization."""

    def __init__(self, label: str, confidence: float, bbox: List[float]):
        self.label = label
        self.confidence = confidence
        self.bbox = bbox

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "confidence": float(self.confidence),
            "bbox": (
                {
                    "x1": float(self.bbox[0]),
                    "y1": float(self.bbox[1]),
                    "x2": float(self.bbox[2]),
                    "y2": float(self.bbox[3]),
                }
                if len(self.bbox) == 4
                else {}
            ),
        }


class _DetectionFrameMsg:
    """Lightweight detection frame message."""

    def __init__(
        self,
        frame_index: int,
        timestamp: float,
        detections: List[_DetectionMsg],
        source: str = "",
        inference_ms: float = 0.0,
        capture_ms: float = 0.0,
    ):
        self.frame_index = frame_index
        self.timestamp = timestamp
        self.detections = detections
        self.source = source
        self.inference_ms = inference_ms
        self.capture_ms = capture_ms

    def to_dict(self) -> dict:
        return {
            "frame_index": self.frame_index,
            "timestamp": self.timestamp,
            "detections": [d.to_dict() for d in self.detections],
            "source": self.source,
            "inference_ms": float(self.inference_ms),
            "capture_ms": float(self.capture_ms),
        }


class PerceptionServicer:
    """
    gRPC servicer that streams perception data from the EventBus.

    Uses thread-safe queue.Queue for cross-thread communication.
    """

    def __init__(self):
        self.event_bus = EventBus()
        self.telemetry = TelemetryProvider()
        self._latest_frame: Optional[_DetectionFrameMsg] = None
        self._subscribers: List[queue.Queue] = []
        self._lock = threading.Lock()

        # Subscribe to detection events
        self.event_bus.subscribe(EventType.DETECTION, self._on_detection)

    def _on_detection(self, event: DetectionEvent) -> None:
        """Handle incoming detection events from the EventBus."""
        detections = [
            _DetectionMsg(
                label=d["class"],
                confidence=d["confidence"],
                bbox=d.get("bbox", [0, 0, 0, 0]),
            )
            for d in event.detections
        ]
        frame = _DetectionFrameMsg(
            frame_index=event.frame_index,
            timestamp=event.timestamp,
            detections=detections,
            source=event.source,
            inference_ms=event.data.get("inference_ms", 0.0),
            capture_ms=event.data.get("capture_ms", 0.0),
        )

        with self._lock:
            self._latest_frame = frame
            for q in self._subscribers:
                try:
                    q.put_nowait(frame)
                except queue.Full:
                    # Evict oldest, enqueue newest
                    try:
                        q.get_nowait()
                    except queue.Empty:
                        pass
                    try:
                        q.put_nowait(frame)
                    except queue.Full:
                        logging.debug("Dropped detection frame for slow subscriber")

    def get_latest_detections(self) -> Optional[dict]:
        """Get the most recent detection frame."""
        with self._lock:
            frame = self._latest_frame
        if frame:
            return frame.to_dict()
        return None

    def get_telemetry(self) -> dict:
        """Get current telemetry metrics."""
        return self.telemetry.get_metrics()

    def create_subscriber(self) -> queue.Queue:
        """Create a new thread-safe subscriber queue for streaming."""
        q: queue.Queue = queue.Queue(maxsize=100)
        with self._lock:
            self._subscribers.append(q)
        return q

    def remove_subscriber(self, q: queue.Queue) -> None:
        """Remove a subscriber queue."""
        with self._lock:
            self._subscribers = [s for s in self._subscribers if s is not q]

    def cleanup(self) -> None:
        """Unsubscribe from EventBus and clear all subscribers."""
        self.event_bus.unsubscribe(EventType.DETECTION, self._on_detection)
        with self._lock:
            self._subscribers.clear()


class PerceptionGRPCServer:
    """
    gRPC server that exposes perception data over a JSON-based protocol.

    Uses grpc reflection-free approach with a generic unary/streaming service.
    For full proto-based gRPC, run protoc codegen on perception.proto.
    """

    def __init__(self, port: int = 50051, max_workers: int = 4):
        self.port = port
        self.max_workers = max_workers
        self.servicer = PerceptionServicer()
        self._server = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._started = threading.Event()
        self._start_error: Optional[Exception] = None

    def start(self) -> None:
        """Start the gRPC server in a background thread. Blocks until ready."""
        if not _GRPC_AVAILABLE:
            logging.warning("grpcio not installed; gRPC perception server disabled")
            return
        if self._running:
            return

        self._started.clear()
        self._start_error = None
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

        if not self._started.wait(timeout=10.0):
            logging.error("gRPC server failed to start within 10 seconds")
            return
        if self._start_error:
            logging.error(f"gRPC server start error: {self._start_error}")
            self._running = False
            return

        self._running = True
        logging.info(f"gRPC PerceptionService started on port {self.port}")

    def _run(self) -> None:
        """Run the gRPC server."""
        try:
            self._server = grpc.server(
                futures.ThreadPoolExecutor(max_workers=self.max_workers)
            )
            handler = _GenericHandler(self.servicer)
            self._server.add_generic_rpc_handlers([handler])

            bound_port = self._server.add_insecure_port(f"[::]:{self.port}")
            if bound_port == 0:
                raise RuntimeError(
                    f"Failed to bind gRPC server to port {self.port} (port may be in use)"
                )

            self._server.start()
            logging.info(f"gRPC server listening on [::]:{self.port}")
            self._started.set()

            self._server.wait_for_termination()
        except Exception as e:
            self._start_error = e
            self._started.set()
            logging.error(f"gRPC server error: {e}")

    def stop(self) -> None:
        """Stop the gRPC server and clean up resources."""
        self._running = False

        # Clean up servicer subscriptions
        self.servicer.cleanup()

        # Stop gRPC server
        if self._server:
            self._server.stop(grace=5)
            self._server = None

        # Join background thread
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=10.0)
            if self._thread.is_alive():
                logging.warning("gRPC server thread did not stop within timeout")
            self._thread = None

        logging.info("gRPC PerceptionService stopped")


class _GenericHandler(grpc.GenericRpcHandler):
    """
    Generic gRPC handler using JSON serialization (avoids proto codegen).
    """

    def __init__(self, servicer: PerceptionServicer):
        self.servicer = servicer
        self._methods = {
            "/openeye.PerceptionService/GetLatestDetections": self._get_latest,
            "/openeye.PerceptionService/GetTelemetry": self._get_telemetry,
            "/openeye.PerceptionService/StreamDetections": self._stream_detections,
            "/openeye.PerceptionService/StreamTelemetry": self._stream_telemetry,
        }

    def service(self, handler_call_details):
        method = handler_call_details.method
        if method in self._methods:
            return self._methods[method]
        return None

    @property
    def _get_latest(self):
        servicer = self.servicer

        def handler(request, context):
            try:
                result = servicer.get_latest_detections()
                if result is None:
                    result = {"frame_index": 0, "timestamp": 0, "detections": [], "source": ""}
                return json.dumps(result).encode("utf-8")
            except Exception as e:
                logging.error(f"GetLatestDetections error: {e}")
                context.abort(grpc.StatusCode.INTERNAL, str(e))

        return grpc.unary_unary_rpc_method_handler(
            handler,
            request_deserializer=lambda x: x,
            response_serializer=lambda x: x,
        )

    @property
    def _get_telemetry(self):
        servicer = self.servicer

        def handler(request, context):
            try:
                result = servicer.get_telemetry()
                return json.dumps(result).encode("utf-8")
            except Exception as e:
                logging.error(f"GetTelemetry error: {e}")
                context.abort(grpc.StatusCode.INTERNAL, str(e))

        return grpc.unary_unary_rpc_method_handler(
            handler,
            request_deserializer=lambda x: x,
            response_serializer=lambda x: x,
        )

    @property
    def _stream_detections(self):
        servicer = self.servicer

        def handler(request, context):
            q = servicer.create_subscriber()
            try:
                while context.is_active():
                    try:
                        frame = q.get(timeout=1.0)
                        yield json.dumps(frame.to_dict()).encode("utf-8")
                    except queue.Empty:
                        continue
                    except Exception as e:
                        logging.error(f"StreamDetections error: {e}")
                        break
            finally:
                servicer.remove_subscriber(q)

        return grpc.unary_stream_rpc_method_handler(
            handler,
            request_deserializer=lambda x: x,
            response_serializer=lambda x: x,
        )

    @property
    def _stream_telemetry(self):
        servicer = self.servicer

        def handler(request, context):
            try:
                while context.is_active():
                    try:
                        metrics = servicer.get_telemetry()
                        yield json.dumps(metrics).encode("utf-8")
                    except Exception as e:
                        logging.error(f"StreamTelemetry error: {e}")
                        break
                    # Shorter sleep intervals for faster shutdown response
                    for _ in range(10):
                        if not context.is_active():
                            return
                        time.sleep(0.1)
            except Exception as e:
                logging.error(f"StreamTelemetry fatal error: {e}")

        return grpc.unary_stream_rpc_method_handler(
            handler,
            request_deserializer=lambda x: x,
            response_serializer=lambda x: x,
        )
