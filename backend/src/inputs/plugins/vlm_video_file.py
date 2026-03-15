"""
VLM_VideoFile - Offline video file analysis using YOLO.

Processes video files (mp4, avi, mkv, etc.) instead of live camera
for offline perception analysis. Supports configurable FPS, per-class
confidence thresholds, and emits the same structured events as the
live camera plugin.
"""

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
from providers.event_bus import DetectionEvent, EventBus
from providers.io_provider import IOProvider
from providers.telemetry_provider import FrameTelemetry, TelemetryProvider


class VLM_VideoFileConfig(SensorConfig):
    video_path: str = Field(description="Path to the video file to process")
    fps: float = Field(
        default=4.0,
        ge=0,
        description="Target processing FPS (0 = process as fast as possible)",
    )
    loop: bool = Field(default=False, description="Loop the video when it ends")
    log_file: bool = Field(default=False, description="Whether to enable file logging")
    confidence_thresholds: Dict[str, float] = Field(
        default_factory=dict,
        description="Per-class confidence thresholds",
    )
    default_confidence: float = Field(
        default=0.25,
        description="Default confidence threshold for unlisted classes",
    )
    start_frame: int = Field(default=0, description="Frame number to start processing from")
    end_frame: Optional[int] = Field(
        default=None, description="Frame number to stop processing at (None = end of video)"
    )


class VLM_VideoFile(FuserInput[VLM_VideoFileConfig, Optional[List]]):
    def __init__(self, config: VLM_VideoFileConfig):
        super().__init__(config)
        self.io_provider = IOProvider()
        self.event_bus = EventBus()
        self.telemetry = TelemetryProvider()
        self.messages: list[Message] = []
        self.descriptor_for_LLM = "Eyes"

        self.video_path = self.config.video_path
        if not os.path.exists(self.video_path):
            raise FileNotFoundError(f"Video file not found: {self.video_path}")

        # Model loading with telemetry
        model_load_start = time.perf_counter()
        self.model = YOLO("yolov8n.pt")
        model_load_ms = (time.perf_counter() - model_load_start) * 1000
        self.telemetry.record_model_load("yolov8n", model_load_ms)

        # Open video file
        self.cap = cv2.VideoCapture(self.video_path)
        if not self.cap.isOpened():
            raise ValueError(f"Could not open video file: {self.video_path}")

        self.video_fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.cam_third = int(self.width / 3) if self.width > 0 else 0

        # Validate: zero-frame video with loop would spin forever
        if self.total_frames == 0 and self.config.loop:
            raise ValueError(
                f"Video has 0 frames and loop=True would spin forever: {self.video_path}"
            )

        # Validate start_frame
        if self.config.start_frame < 0:
            raise ValueError(f"start_frame must be >= 0, got {self.config.start_frame}")
        if self.total_frames > 0 and self.config.start_frame >= self.total_frames:
            raise ValueError(
                f"start_frame ({self.config.start_frame}) >= total_frames ({self.total_frames})"
            )

        # Validate end_frame
        if self.config.end_frame is not None:
            if self.config.end_frame < self.config.start_frame:
                raise ValueError(
                    f"end_frame ({self.config.end_frame}) < start_frame ({self.config.start_frame})"
                )

        # FPS config
        self.target_fps = self.config.fps
        self._frame_interval = 1.0 / self.target_fps if self.target_fps > 0 else 0

        # Calculate frame skip to match target FPS
        if self.target_fps > 0 and self.target_fps < self.video_fps:
            self._frame_skip = int(self.video_fps / self.target_fps)
        else:
            self._frame_skip = 1

        # Confidence thresholds
        self.confidence_thresholds = dict(self.config.confidence_thresholds)
        self.default_confidence = self.config.default_confidence

        # Seek to start frame
        if self.config.start_frame > 0:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, self.config.start_frame)

        self.frame_index = self.config.start_frame
        self.end_frame = self.config.end_frame
        self._finished = False

        # File logging
        self.write_to_local_file = self.config.log_file
        self.filename_current = None
        self.max_file_size_bytes = 1024 * 1024
        if self.write_to_local_file:
            self.filename_current = self._make_filename()

        logging.info(
            f"VideoFile input: {self.video_path} "
            f"({self.total_frames} frames, {self.video_fps:.1f} fps, "
            f"{self.width}x{self.height})"
        )

    def _make_filename(self) -> str:
        unix_ts = str(round(time.time(), 6)).replace(".", "_")
        os.makedirs("dump", exist_ok=True)
        return f"dump/video_{unix_ts}Z.jsonl"

    def _passes_threshold(self, label: str, confidence: float) -> bool:
        threshold = self.confidence_thresholds.get(label, self.default_confidence)
        return confidence >= threshold

    def get_top_detection(self, detections: List[dict]) -> tuple:
        if not detections:
            return None, None
        top = max(detections, key=lambda d: d["confidence"])
        return top["class"], top["bbox"]

    async def _poll(self) -> Optional[List]:
        if self._finished:
            await asyncio.sleep(1.0)
            return None

        if self._frame_interval > 0:
            await asyncio.sleep(self._frame_interval)

        # Skip frames to match target FPS
        for _ in range(self._frame_skip - 1):
            # Don't skip past end_frame
            if self.end_frame is not None and self.frame_index + 1 > self.end_frame:
                break
            try:
                ret = self.cap.grab()
            except Exception as e:
                logging.error(f"Exception during frame grab: {e}")
                break
            if not ret:
                break
            self.frame_index += 1

        frame_start = time.perf_counter()
        try:
            ret, frame = self.cap.read()
        except Exception as e:
            logging.error(f"Exception reading video frame: {e}")
            self._finished = True
            return None
        capture_ms = (time.perf_counter() - frame_start) * 1000

        if not ret or frame is None:
            if self.config.loop:
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, self.config.start_frame)
                self.frame_index = self.config.start_frame
                logging.info("Video looped back to start")
                return None
            else:
                logging.info(f"Video file finished: {self.video_path}")
                self._finished = True
                return None

        self.frame_index += 1
        if self.end_frame is not None and self.frame_index > self.end_frame:
            if self.config.loop:
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, self.config.start_frame)
                self.frame_index = self.config.start_frame
                return None
            else:
                self._finished = True
                return None

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
        progress = (self.frame_index / self.total_frames * 100) if self.total_frames > 0 else 0
        self.telemetry.record_frame(
            FrameTelemetry(
                frame_index=self.frame_index,
                timestamp=timestamp,
                capture_ms=capture_ms,
                inference_ms=inference_ms,
                total_ms=total_ms,
                num_detections=len(detections),
                source=f"VLM_VideoFile({os.path.basename(self.video_path)})",
            )
        )

        # Emit detection event
        self.event_bus.publish(
            DetectionEvent(
                source="VLM_VideoFile",
                timestamp=timestamp,
                frame_index=self.frame_index,
                detections=detections,
                data={
                    "video_path": self.video_path,
                    "progress_pct": round(progress, 1),
                    "capture_ms": round(capture_ms, 2),
                    "inference_ms": round(inference_ms, 2),
                },
            )
        )

        if self.write_to_local_file and self.filename_current:
            try:
                json_line = json.dumps({
                    "frame": self.frame_index,
                    "timestamp": timestamp,
                    "detections": detections,
                    "video_progress_pct": round(progress, 1),
                })
                self._write_str_to_file(json_line)
            except Exception as e:
                logging.error(f"Error saving video detections: {e}")

        return detections

    def _write_str_to_file(self, json_line: str):
        if (
            self.filename_current is not None
            and os.path.exists(self.filename_current)
            and os.path.getsize(self.filename_current) > self.max_file_size_bytes
        ):
            self.filename_current = self._make_filename()
        if self.filename_current is not None:
            with open(self.filename_current, "a", encoding="utf-8") as f:
                f.write(json_line + "\n")
                f.flush()

    async def _raw_to_text(self, raw_input: Optional[List]) -> Optional[Message]:
        detections = raw_input
        if detections:
            thing, bbox = self.get_top_detection(detections)
            x1 = bbox[0]
            x2 = bbox[2]
            center_x = (x1 + x2) / 2
            direction = "in front of you"
            if self.cam_third > 0:
                if center_x < self.cam_third:
                    direction = "on your left"
                elif center_x > 2 * self.cam_third:
                    direction = "on your right"
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

    @property
    def is_finished(self) -> bool:
        return self._finished

    def stop(self):
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception as exc:
                logging.debug("Error releasing video capture: %s", exc)
            self.cap = None
