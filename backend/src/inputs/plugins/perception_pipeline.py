"""FuserInput plugin that wraps the unified PerceptionPipeline.

Integrates the full perception pipeline (stories 46-60) as a standard
input sensor for the cortex runtime.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import List, Optional

import cv2
import numpy as np
from pydantic import Field
from ultralytics import YOLO

from inputs.base import Message, SensorConfig
from inputs.base.loop import FuserInput
from perception.models import PerceptionFrame, RegionOfInterest
from perception.pipeline import PerceptionPipeline
from providers.io_provider import IOProvider


class PerceptionPipelineConfig(SensorConfig):
    camera_index: int = Field(default=0, description="Camera device index")
    yolo_model: str = Field(default="yolov8n.pt", description="YOLO model weights")
    enable_depth: bool = Field(default=False, description="Enable depth estimation")
    danger_zone_m: float = Field(default=0.5, description="Danger zone radius (metres)")
    caution_zone_m: float = Field(default=1.5, description="Caution zone radius (metres)")
    robot_goal: str = Field(default="", description="Current robot goal")
    lighting_robustness: bool = Field(default=True, description="Enable CLAHE lighting normalisation")
    poll_interval: float = Field(default=0.033, description="Polling interval in seconds (~30fps)")


class PerceptionPipelineSensor(FuserInput[PerceptionPipelineConfig, Optional[PerceptionFrame]]):
    """Unified perception sensor producing PerceptionFrame outputs."""

    def __init__(self, config: PerceptionPipelineConfig):
        super().__init__(config)
        self.io_provider = IOProvider()
        self.messages: list[Message] = []
        self.descriptor_for_LLM = "Perception"

        # Initialise YOLO detector
        self._yolo = YOLO(config.yolo_model)

        # Camera setup
        self._cap: Optional[cv2.VideoCapture] = None
        self._frame_w = 0
        self._frame_h = 0
        self._have_cam = False
        self._setup_camera(config.camera_index)

        # Depth estimator (optional)
        self._depth_estimator = None
        if config.enable_depth:
            self._depth_estimator = self._load_depth_estimator()

        # Build pipeline
        self._pipeline = PerceptionPipeline(
            detector=self._detect,
            depth_estimator=self._depth_estimator,
            danger_m=config.danger_zone_m,
            caution_m=config.caution_zone_m,
            robot_goal=config.robot_goal,
            lighting_robustness=config.lighting_robustness,
        )

    def _setup_camera(self, index: int) -> None:
        cap = cv2.VideoCapture(index)
        if not cap.isOpened():
            logging.error(f"PerceptionPipeline: camera {index} not found")
            return
        self._cap = cap
        self._frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self._frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self._have_cam = True
        logging.info(
            f"PerceptionPipeline: camera {index} at {self._frame_w}x{self._frame_h}"
        )

    def _detect(self, frame: np.ndarray) -> list[dict]:
        """Run YOLO detection on a frame."""
        results = self._yolo.predict(source=frame, save=False, stream=True, verbose=False)
        detections = []
        for r in results:
            if r.boxes is not None:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(float, box.xyxy[0])
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    label = self._yolo.names[cls]
                    detections.append({
                        "label": label,
                        "confidence": round(conf, 4),
                        "bbox": [round(x1), round(y1), round(x2), round(y2)],
                    })
        return detections

    @staticmethod
    def _load_depth_estimator():
        """Attempt to load Depth Anything V2 for depth estimation."""
        try:
            from transformers import pipeline as hf_pipeline
            pipe = hf_pipeline(
                "depth-estimation",
                model="depth-anything/Depth-Anything-V2-Small-hf",
                device="cpu",
            )

            def estimate(frame: np.ndarray) -> np.ndarray:
                from PIL import Image
                img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                result = pipe(img)
                depth = np.array(result["depth"], dtype=np.float32)
                # Normalise to approximate metres (heuristic)
                depth_norm = (depth - depth.min()) / (depth.max() - depth.min() + 1e-8)
                return depth_norm * 5.0  # scale to ~5m max range

            logging.info("PerceptionPipeline: Depth Anything V2 loaded")
            return estimate
        except Exception as e:
            logging.warning(f"PerceptionPipeline: depth estimation unavailable: {e}")
            return None

    def set_roi(self, roi: Optional[RegionOfInterest]) -> None:
        """Set region of interest for focused perception."""
        self._pipeline.set_roi(roi)

    def set_goal(self, goal: str) -> None:
        """Update the robot's current goal."""
        self._pipeline.set_goal(goal)

    def query(self, question: str):
        """Natural language query on the current scene."""
        return self._pipeline.query(question)

    async def _poll(self) -> Optional[PerceptionFrame]:
        await asyncio.sleep(self.config.poll_interval)
        if not self._have_cam or self._cap is None:
            return None
        ret, frame = self._cap.read()
        if not ret or frame is None:
            return None
        return self._pipeline.process_frame(frame=frame)

    async def _raw_to_text(self, raw_input: Optional[PerceptionFrame]) -> Optional[Message]:
        pf = raw_input
        if pf is None:
            return None

        parts = [f"[Frame {pf.frame_id} | {pf.inference_ms:.0f}ms]"]

        # Objects
        if pf.objects:
            obj_strs = []
            for o in pf.objects:
                s = f"{o.label}({o.track_id}, conf={o.confidence:.2f}"
                if o.position_3d:
                    s += f", pos=({o.position_3d.x:.2f},{o.position_3d.y:.2f},{o.position_3d.z:.2f})m"
                s += ")"
                obj_strs.append(s)
            parts.append(f"Objects: {', '.join(obj_strs)}")

        # Spatial relationships
        if pf.scene_graph.relationships:
            rels = [
                f"{r.subject_id} {r.relation.value} {r.object_id}"
                for r in pf.scene_graph.relationships[:5]
            ]
            parts.append(f"Relations: {'; '.join(rels)}")

        # Safety
        if pf.safety_alerts:
            for alert in pf.safety_alerts:
                parts.append(f"SAFETY [{alert.zone.value.upper()}]: {alert.message}")

        # Change alerts
        if pf.change_alerts:
            for ca in pf.change_alerts:
                parts.append(f"CHANGE: {ca.description}")

        # Action suggestions
        if pf.action_suggestions:
            for s in pf.action_suggestions:
                parts.append(f"SUGGEST: {s.action} → {s.reason}")

        # Scene description
        if pf.scene_description:
            parts.append(f"Scene: {pf.scene_description}")

        return Message(timestamp=pf.timestamp, message="\n".join(parts))

    async def raw_to_text(self, raw_input: Optional[PerceptionFrame]):
        msg = await self._raw_to_text(raw_input)
        if msg is not None:
            self.messages.append(msg)

    def formatted_latest_buffer(self) -> Optional[str]:
        if not self.messages:
            return None
        latest = self.messages[-1]
        result = (
            f"\nINPUT: {self.descriptor_for_LLM}\n// START\n"
            f"{latest.message}\n// END\n"
        )
        self.io_provider.add_input(
            self.descriptor_for_LLM, latest.message, latest.timestamp
        )
        self.messages = []
        return result

    def stop(self):
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        self._have_cam = False
