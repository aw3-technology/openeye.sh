import asyncio
import json
import logging
import os
import time
from typing import Dict, List, Optional

import cv2
from pydantic import Field
from ultralytics import YOLO

from inputs.base import Message, SensorConfig
from inputs.base.loop import FuserInput
from providers.event_bus import DetectionEvent, EventBus, EventType, PerceptionEvent
from providers.io_provider import IOProvider
from providers.telemetry_provider import FrameTelemetry, TelemetryProvider


class VLM_Local_YOLOConfig(SensorConfig):
    camera_index: int = Field(default=0, description="Index of the camera device")
    fps: float = Field(default=4.0, gt=0, description="Target frames per second for capture")
    log_file: bool = Field(default=False, description="Whether to enable file logging")
    confidence_thresholds: Dict[str, float] = Field(
        default_factory=dict,
        description="Per-class confidence thresholds, e.g. {'person': 0.6, 'car': 0.4}. "
        "Classes not listed use the default_confidence.",
    )
    default_confidence: float = Field(
        default=0.25,
        description="Default confidence threshold for classes not in confidence_thresholds",
    )
    reconnect_attempts: int = Field(
        default=5, description="Max camera reconnect attempts before giving up"
    )
    reconnect_delay: float = Field(
        default=2.0, description="Seconds to wait between reconnect attempts"
    )


RESOLUTIONS = [
    (3840, 2160),
    (2560, 1440),
    (1920, 1080),
    (1280, 720),
    (1024, 576),
    (800, 600),
    (640, 480),
]


def set_best_resolution(cap: cv2.VideoCapture, resolutions: List[tuple]) -> tuple:
    for width, height in resolutions:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        time.sleep(0.1)
        actual_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if actual_width == width and actual_height == height:
            logging.info(f"Resolution set to: {width}x{height}")
            return width, height
    logging.info("Could not set preferred resolution. Using default.")
    return int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))


def check_webcam(index_to_check):
    cap = cv2.VideoCapture(index_to_check)
    if not cap.isOpened():
        logging.error(f"YOLO did not find cam: {index_to_check}")
        cap.release()
        return 0, 0
    width, height = set_best_resolution(cap, RESOLUTIONS)
    logging.info(f"YOLO found cam: {index_to_check} set to {width}x{height}")
    cap.release()
    return width, height


class VLM_Local_YOLO(FuserInput[VLM_Local_YOLOConfig, Optional[List]]):
    def __init__(self, config: VLM_Local_YOLOConfig):
        super().__init__(config)
        self.camera_index = self.config.camera_index
        self.io_provider = IOProvider()
        self.event_bus = EventBus()
        self.telemetry = TelemetryProvider()
        self.messages: list[Message] = []
        self.descriptor_for_LLM = "Eyes"

        # Model loading with telemetry
        model_load_start = time.perf_counter()
        self.model = YOLO("yolov8n.pt")
        model_load_ms = (time.perf_counter() - model_load_start) * 1000
        self.telemetry.record_model_load("yolov8n", model_load_ms)

        # FPS config
        self.target_fps = self.config.fps
        self._frame_interval = 1.0 / self.target_fps

        # Confidence thresholds
        self.confidence_thresholds = dict(self.config.confidence_thresholds)
        self.default_confidence = self.config.default_confidence

        # File logging
        self.write_to_local_file = False
        if self.config.log_file:
            self.write_to_local_file = self.config.log_file
        self.filename_current = None
        self.max_file_size_bytes = 1024 * 1024
        if self.write_to_local_file:
            self.filename_current = self.update_filename()

        # Camera init
        self.width, self.height = check_webcam(self.camera_index)
        self.have_cam = self.width > 0
        self.frame_index = 0
        self.cam_third = int(self.width / 3) if self.width > 0 else 0
        self.cap = None
        self._camera_disconnected = False

        if self.have_cam:
            self._open_camera()

    def _open_camera(self) -> bool:
        """Open the camera capture device."""
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            if not self.cap.isOpened():
                logging.error(f"Failed to open camera {self.camera_index}")
                self.have_cam = False
                return False
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
            self.cam_third = int(self.width / 3)
            self.have_cam = True
            self._camera_disconnected = False
            logging.info(f"Camera {self.camera_index} opened: {self.width}x{self.height}")
            return True
        except Exception as e:
            logging.error(f"Error opening camera: {e}")
            self.telemetry.record_error("camera", "open_failed", str(e))
            self.have_cam = False
            return False

    async def _reconnect_camera(self) -> bool:
        """Attempt to reconnect to the camera with retries."""
        max_attempts = self.config.reconnect_attempts
        delay = self.config.reconnect_delay

        logging.warning(
            f"Camera {self.camera_index} disconnected, attempting reconnect "
            f"(max {max_attempts} attempts, {delay}s delay)"
        )
        self.event_bus.publish(
            PerceptionEvent(
                event_type=EventType.CAMERA_STATUS,
                source="VLM_Local_YOLO",
                data={"status": "disconnected", "camera_index": self.camera_index},
            )
        )

        for attempt in range(1, max_attempts + 1):
            await asyncio.sleep(delay)
            logging.info(f"Reconnect attempt {attempt}/{max_attempts}...")

            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception as exc:
                    logging.debug("Error releasing camera during reconnect: %s", exc)

            if self._open_camera():
                self.telemetry.record_camera_reconnect()
                self.event_bus.publish(
                    PerceptionEvent(
                        event_type=EventType.CAMERA_STATUS,
                        source="VLM_Local_YOLO",
                        data={
                            "status": "reconnected",
                            "camera_index": self.camera_index,
                            "attempt": attempt,
                        },
                    )
                )
                logging.info(f"Camera reconnected on attempt {attempt}")
                return True

        logging.error(f"Failed to reconnect camera after {max_attempts} attempts")
        self.telemetry.record_error(
            "camera", "reconnect_failed", f"Failed after {max_attempts} attempts"
        )
        self._camera_disconnected = True
        return False

    def _passes_threshold(self, label: str, confidence: float) -> bool:
        """Check if a detection passes the per-class confidence threshold."""
        threshold = self.confidence_thresholds.get(label, self.default_confidence)
        return confidence >= threshold

    def update_filename(self):
        dump_dir = "dump"
        os.makedirs(dump_dir, exist_ok=True)
        unix_ts = round(time.time(), 6)
        unix_ts = str(unix_ts).replace(".", "_")
        filename = f"{dump_dir}/yolo_{unix_ts}Z.jsonl"
        return filename

    def get_top_detection(self, detections: List[dict]) -> tuple:
        if not detections:
            return None, None
        top = max(detections, key=lambda d: d["confidence"])
        return top["class"], top["bbox"]

    async def _poll(self) -> Optional[List]:
        await asyncio.sleep(self._frame_interval)

        if not self.have_cam or self.cap is None:
            if not self._camera_disconnected:
                reconnected = await self._reconnect_camera()
                if not reconnected:
                    return None
            else:
                # Already failed reconnect, wait longer before trying again
                await asyncio.sleep(5.0)
                self._camera_disconnected = False  # Allow retry
                return None

        frame_start = time.perf_counter()
        try:
            ret, frame = self.cap.read()
        except Exception as e:
            logging.error(f"Exception reading frame from camera: {e}")
            self.telemetry.record_error("camera", "read_exception", str(e))
            self.have_cam = False
            reconnected = await self._reconnect_camera()
            if not reconnected:
                return None
            try:
                ret, frame = self.cap.read()
            except Exception:
                return None

        if not ret or frame is None:
            logging.warning("Failed to read frame from camera")
            self.have_cam = False
            reconnected = await self._reconnect_camera()
            if not reconnected:
                return None
            # Try one more read after reconnect
            try:
                ret, frame = self.cap.read()
            except Exception:
                return None
            if not ret or frame is None:
                return None

        capture_time = time.perf_counter()
        capture_ms = (capture_time - frame_start) * 1000

        self.frame_index += 1
        timestamp = time.time()

        inference_start = time.perf_counter()
        results = self.model.predict(source=frame, save=False, stream=True, verbose=False)
        detections = []
        for r in results:
            if r.boxes is not None:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(float, box.xyxy[0])
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    label = self.model.names[cls]
                    if self._passes_threshold(label, conf):
                        detections.append({
                            "class": label,
                            "confidence": round(conf, 4),
                            "bbox": [round(x1), round(y1), round(x2), round(y2)],
                        })
        inference_ms = (time.perf_counter() - inference_start) * 1000
        total_ms = (time.perf_counter() - frame_start) * 1000

        # Record telemetry
        self.telemetry.record_frame(
            FrameTelemetry(
                frame_index=self.frame_index,
                timestamp=timestamp,
                capture_ms=capture_ms,
                inference_ms=inference_ms,
                total_ms=total_ms,
                num_detections=len(detections),
                source="VLM_Local_YOLO",
            )
        )

        # Emit detection event
        self.event_bus.publish(
            DetectionEvent(
                source="VLM_Local_YOLO",
                timestamp=timestamp,
                frame_index=self.frame_index,
                detections=detections,
                data={
                    "capture_ms": round(capture_ms, 2),
                    "inference_ms": round(inference_ms, 2),
                    "total_ms": round(total_ms, 2),
                },
            )
        )

        if self.write_to_local_file:
            try:
                json_line = json.dumps({
                    "frame": self.frame_index,
                    "timestamp": timestamp,
                    "detections": detections,
                })
                self.write_str_to_file(json_line)
            except Exception as e:
                logging.error(f"Error saving YOLO: {str(e)}")
                self.telemetry.record_error("file_logging", "write_failed", str(e))

        return detections

    def write_str_to_file(self, json_line: str):
        if not isinstance(json_line, str):
            raise ValueError("Provided json_line must be a json string.")
        if (
            self.filename_current is not None
            and os.path.exists(self.filename_current)
            and os.path.getsize(self.filename_current) > self.max_file_size_bytes
        ):
            self.filename_current = self.update_filename()
        if self.filename_current is not None:
            with open(self.filename_current, "a", encoding="utf-8") as f:
                f.write(json_line + "\n")
                f.flush()

    async def _raw_to_text(self, raw_input: Optional[List]) -> Optional[Message]:
        detections = raw_input
        if detections:
            thing, bbox = self.get_top_detection(detections)
            if thing is None or bbox is None:
                return None
            x1 = bbox[0]
            x2 = bbox[2]
            center_x = (x1 + x2) / 2
            direction = "in the center"
            if self.cam_third > 0:
                if center_x < self.cam_third:
                    direction = "on the left"
                elif center_x > 2 * self.cam_third:
                    direction = "on the right"
            sentence = f"You see a {thing} {direction}."
            return Message(timestamp=time.time(), message=sentence)

    async def raw_to_text(self, raw_input: Optional[List]):
        pending_message = await self._raw_to_text(raw_input)
        if pending_message is not None:
            self.messages.append(pending_message)

    def formatted_latest_buffer(self) -> Optional[str]:
        if len(self.messages) == 0:
            return None
        latest_message = self.messages[-1]
        result = (
            f"\nINPUT: {self.descriptor_for_LLM}\n// START\n"
            f"{latest_message.message}\n// END\n"
        )
        self.io_provider.add_input(
            self.descriptor_for_LLM, latest_message.message, latest_message.timestamp
        )
        self.messages = []
        return result

    def stop(self):
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception as exc:
                logging.debug("Error releasing camera: %s", exc)
            self.cap = None
        self.have_cam = False
