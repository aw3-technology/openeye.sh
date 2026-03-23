import asyncio
import logging
import time
from typing import Dict, List, Optional

from pydantic import Field
from ultralytics import YOLO

from inputs.base import Message, SensorConfig
from inputs.base.loop import FuserInput
from inputs.plugins.camera import CameraManager
from inputs.plugins.detection_processor import DetectionProcessor
from inputs.plugins.yolo_file_logger import YOLOFileLogger
from providers import Providers


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


class VLM_Local_YOLO(FuserInput[VLM_Local_YOLOConfig, Optional[List]]):
    def __init__(self, config: VLM_Local_YOLOConfig):
        super().__init__(config)
        self.camera_index = self.config.camera_index
        self._providers = Providers()
        self.io_provider = self._providers.io
        self.event_bus = self._providers.events
        self.telemetry = self._providers.telemetry
        self.messages: list[Message] = []
        self.descriptor_for_LLM = "Eyes"

        # Detection processor (shared with VLM_VideoFile)
        self._detector = DetectionProcessor(
            event_bus=self._providers.events,
            telemetry=self._providers.telemetry,
            confidence_thresholds=dict(self.config.confidence_thresholds),
            default_confidence=self.config.default_confidence,
            source_name="VLM_Local_YOLO",
        )

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

        # File logging (delegated to YOLOFileLogger)
        self.write_to_local_file = False
        if self.config.log_file:
            self.write_to_local_file = self.config.log_file
        self._file_logger = YOLOFileLogger(
            enabled=self.write_to_local_file,
        )
        self.filename_current = self._file_logger.filename_current
        self.max_file_size_bytes = self._file_logger.max_file_size_bytes

        # Camera management (delegated to CameraManager)
        self._camera = CameraManager(
            camera_index=self.camera_index,
            reconnect_attempts=self.config.reconnect_attempts,
            reconnect_delay=self.config.reconnect_delay,
            telemetry=self.telemetry,
            event_bus=self.event_bus,
        )
        self.width = self._camera.width
        self.height = self._camera.height
        self.have_cam = self._camera.have_cam
        self.frame_index = 0
        self.cam_third = self._camera.cam_third
        self.cap = self._camera.cap
        self._camera_disconnected = self._camera._camera_disconnected

    def _open_camera(self) -> bool:
        """Open the camera capture device."""
        result = self._camera._open_camera()
        self._sync_camera_state()
        return result

    async def _reconnect_camera(self) -> bool:
        """Attempt to reconnect to the camera with retries."""
        result = await self._camera._reconnect_camera()
        self._sync_camera_state()
        return result

    def _sync_camera_state(self):
        """Sync local attributes from camera manager."""
        self.width = self._camera.width
        self.height = self._camera.height
        self.have_cam = self._camera.have_cam
        self.cam_third = self._camera.cam_third
        self._detector.cam_third = self.cam_third
        self.cap = self._camera.cap
        self._camera_disconnected = self._camera._camera_disconnected

    def update_filename(self):
        filename = self._file_logger.update_filename()
        self.filename_current = self._file_logger.filename_current
        return filename

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
                self._camera_disconnected = False
                self._camera._camera_disconnected = False
                return None

        frame_start = time.perf_counter()
        try:
            ret, frame = self.cap.read()
        except Exception as e:
            logging.error(f"Exception reading frame from camera: {e}")
            self.telemetry.record_error("camera", "read_exception", str(e))
            self.have_cam = False
            self._camera.have_cam = False
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
            self._camera.have_cam = False
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
        detections = self._detector.extract_detections(results, self.model.names)
        inference_ms = (time.perf_counter() - inference_start) * 1000
        total_ms = (time.perf_counter() - frame_start) * 1000

        self._detector.record_telemetry(
            frame_index=self.frame_index,
            timestamp=timestamp,
            capture_ms=capture_ms,
            inference_ms=inference_ms,
            total_ms=total_ms,
            num_detections=len(detections),
        )

        self._detector.publish_detection_event(
            timestamp=timestamp,
            frame_index=self.frame_index,
            detections=detections,
            extra_data={
                "capture_ms": round(capture_ms, 2),
                "inference_ms": round(inference_ms, 2),
                "total_ms": round(total_ms, 2),
            },
        )

        if self.write_to_local_file:
            self._detector.log_detections_to_file(
                write_fn=self.write_str_to_file,
                frame_index=self.frame_index,
                timestamp=timestamp,
                detections=detections,
            )

        return detections

    def write_str_to_file(self, json_line: str):
        self._file_logger.write_str_to_file(json_line)
        self.filename_current = self._file_logger.filename_current

    async def _raw_to_text(self, raw_input: Optional[List]) -> Optional[Message]:
        if raw_input:
            return self._detector.detections_to_text(raw_input)

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
        self._camera.stop()
        self.cap = None
        self.have_cam = False
