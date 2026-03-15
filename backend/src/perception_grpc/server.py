"""Full-featured gRPC server wrapping PerceptionPipeline directly.

Unlike the original ``perception_service.py`` (which streams EventBus events),
this server wraps the pipeline and supports the complete ``PerceptionFrame``:
objects, scene graph, safety, grasp points, floor plane, etc.

Uses the generic JSON-over-gRPC pattern (no compiled stubs required) following
the same approach as ``perception_service.py``.
"""

from __future__ import annotations

import json
import logging
import queue
import threading
import time
from concurrent import futures
from typing import Any, Optional

import numpy as np

from perception.pipeline import PerceptionPipeline
from perception_grpc.converters import perception_frame_to_dict

logger = logging.getLogger(__name__)

_SERVICE_NAME = "openeye.RobotVisionService"


class PerceptionGRPCServer:
    """gRPC server exposing the full perception pipeline.

    Parameters
    ----------
    pipeline : PerceptionPipeline
        An already-initialised pipeline instance.
    port : int
        Port to listen on (default 50051).
    max_workers : int
        Thread pool size.
    """

    def __init__(
        self,
        pipeline: PerceptionPipeline,
        port: int = 50051,
        max_workers: int = 4,
    ) -> None:
        self._pipeline = pipeline
        self._port = port
        self._max_workers = max_workers
        self._server: Any = None
        self._start_time = 0.0
        self._frames_processed = 0
        self._subscribers: list[queue.Queue] = []
        self._lock = threading.Lock()

    def start(self) -> None:
        """Start the gRPC server in a background thread."""
        import grpc

        self._start_time = time.time()
        handler = _RobotVisionHandler(self)
        self._server = grpc.server(
            futures.ThreadPoolExecutor(max_workers=self._max_workers),
            handlers=[handler],
        )
        self._server.add_insecure_port(f"[::]:{self._port}")
        self._server.start()
        logger.info("RobotVision gRPC server started on port %d", self._port)

    def stop(self, grace: float = 2.0) -> None:
        """Graceful shutdown."""
        if self._server is not None:
            self._server.stop(grace)
            self._server = None
            logger.info("RobotVision gRPC server stopped")

    def wait_for_termination(self, timeout: Optional[float] = None) -> None:
        if self._server is not None:
            self._server.wait_for_termination(timeout)

    # ── Internal ─────────────────────────────────────────────────────

    def _perceive(self, frame: np.ndarray, depth: Optional[np.ndarray] = None) -> dict:
        result = self._pipeline.process_frame(frame=frame, depth_map=depth)
        self._frames_processed += 1
        d = perception_frame_to_dict(result)
        # Broadcast to subscribers
        with self._lock:
            for q in self._subscribers:
                try:
                    q.put_nowait(d)
                except queue.Full:
                    try:
                        q.get_nowait()
                        q.put_nowait(d)
                    except queue.Empty:
                        pass
        return d

    def _add_subscriber(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=100)
        with self._lock:
            self._subscribers.append(q)
        return q

    def _remove_subscriber(self, q: queue.Queue) -> None:
        with self._lock:
            try:
                self._subscribers.remove(q)
            except ValueError:
                pass


class _RobotVisionHandler:
    """Generic gRPC handler for RobotVisionService (JSON-based, no stubs)."""

    def __init__(self, server: PerceptionGRPCServer) -> None:
        self._server = server

    def service(self, handler_call_details: Any) -> Any:
        import grpc

        method = handler_call_details.method
        rpc_map = {
            f"/{_SERVICE_NAME}/Perceive": (
                grpc.unary_unary_rpc_method_handler(self._handle_perceive),
            ),
            f"/{_SERVICE_NAME}/StreamPerception": (
                grpc.stream_stream_rpc_method_handler(self._handle_stream),
            ),
            f"/{_SERVICE_NAME}/Subscribe": (
                grpc.unary_stream_rpc_method_handler(self._handle_subscribe),
            ),
            f"/{_SERVICE_NAME}/Query": (
                grpc.unary_unary_rpc_method_handler(self._handle_query),
            ),
            f"/{_SERVICE_NAME}/SetGoal": (
                grpc.unary_unary_rpc_method_handler(self._handle_set_goal),
            ),
            f"/{_SERVICE_NAME}/Health": (
                grpc.unary_unary_rpc_method_handler(self._handle_health),
            ),
        }
        handlers = rpc_map.get(method)
        return handlers[0] if handlers else None

    # ── RPC handlers ─────────────────────────────────────────────────

    def _handle_perceive(self, request_bytes: bytes, context: Any) -> bytes:
        req = json.loads(request_bytes or b"{}")
        frame = _decode_frame(req)
        depth = _decode_depth(req)
        result = self._server._perceive(frame, depth)
        return json.dumps(result).encode()

    def _handle_stream(self, request_iterator: Any, context: Any) -> Any:
        for request_bytes in request_iterator:
            req = json.loads(request_bytes or b"{}")
            frame = _decode_frame(req)
            depth = _decode_depth(req)
            result = self._server._perceive(frame, depth)
            yield json.dumps(result).encode()

    def _handle_subscribe(self, request_bytes: bytes, context: Any) -> Any:
        q = self._server._add_subscriber()
        try:
            while context.is_active():
                try:
                    data = q.get(timeout=0.1)
                    yield json.dumps(data).encode()
                except queue.Empty:
                    continue
        finally:
            self._server._remove_subscriber(q)

    def _handle_query(self, request_bytes: bytes, context: Any) -> bytes:
        req = json.loads(request_bytes or b"{}")
        question = req.get("question", "")
        result = self._server._pipeline.query(question)
        return json.dumps({
            "answer": result.answer,
            "matched_object_ids": result.matched_objects,
            "confidence": result.confidence,
        }).encode()

    def _handle_set_goal(self, request_bytes: bytes, context: Any) -> bytes:
        req = json.loads(request_bytes or b"{}")
        goal = req.get("goal", "")
        self._server._pipeline.set_goal(goal)
        return json.dumps({
            "accepted": True,
            "active_goal": goal,
        }).encode()

    def _handle_health(self, request_bytes: bytes, context: Any) -> bytes:
        uptime = time.time() - self._server._start_time
        return json.dumps({
            "healthy": True,
            "model_name": "perception_pipeline",
            "frames_processed": self._server._frames_processed,
            "uptime_seconds": uptime,
        }).encode()


# ── Helpers ──────────────────────────────────────────────────────────

import base64


def _decode_frame(req: dict) -> np.ndarray:
    """Decode a raw frame from a gRPC request dict."""
    data = req.get("frame_data", "")
    w = req.get("width", 640)
    h = req.get("height", 480)
    ch = req.get("channels", 3)
    if isinstance(data, str):
        raw = base64.b64decode(data)
    else:
        raw = data
    if len(raw) == 0:
        return np.zeros((h, w, ch), dtype=np.uint8)
    return np.frombuffer(raw, dtype=np.uint8).reshape(h, w, ch)


def _decode_depth(req: dict) -> Optional[np.ndarray]:
    """Optionally decode a depth map from a gRPC request dict."""
    data = req.get("depth_data", "")
    if not data:
        return None
    dw = req.get("depth_width", 0)
    dh = req.get("depth_height", 0)
    if dw == 0 or dh == 0:
        return None
    if isinstance(data, str):
        raw = base64.b64decode(data)
    else:
        raw = data
    return np.frombuffer(raw, dtype=np.float32).reshape(dh, dw)
