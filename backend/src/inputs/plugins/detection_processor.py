"""
DetectionProcessor - Shared YOLO detection processing utility.

Extracts duplicated logic from VLM_VideoFile and VLM_Local_YOLO:
  - YOLO result → detection dict extraction
  - Per-class confidence threshold filtering
  - Top detection selection
  - Telemetry recording
  - EventBus publishing
  - File logging
  - Detection-to-text spatial conversion
"""

import json
import logging
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from inputs.base import Message
from providers.event_bus import DetectionEvent, EventBus, EventType
from providers.telemetry_provider import FrameTelemetry, TelemetryProvider


class DetectionProcessor:
    """Reusable detection processing pipeline for YOLO-based plugins."""

    def __init__(
        self,
        *,
        event_bus: EventBus,
        telemetry: TelemetryProvider,
        confidence_thresholds: Dict[str, float],
        default_confidence: float = 0.25,
        source_name: str = "unknown",
        cam_third: int = 0,
    ):
        self.event_bus = event_bus
        self.telemetry = telemetry
        self.confidence_thresholds = dict(confidence_thresholds)
        self.default_confidence = default_confidence
        self.source_name = source_name
        self.cam_third = cam_third

    def passes_threshold(self, label: str, confidence: float) -> bool:
        """Check if a detection passes the per-class confidence threshold."""
        threshold = self.confidence_thresholds.get(label, self.default_confidence)
        return confidence >= threshold

    def extract_detections(self, results, model_names: Dict[int, str]) -> List[Dict[str, Any]]:
        """
        Extract detection dicts from YOLO results.

        Parameters
        ----------
        results : iterable
            YOLO model.predict() results (may be a generator).
        model_names : dict
            Mapping from class index to label (model.names).

        Returns
        -------
        list[dict]
            List of detection dicts with keys: class, confidence, bbox.
        """
        detections: List[Dict[str, Any]] = []
        for r in results:
            if r.boxes is not None:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(float, box.xyxy[0])
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    label = model_names[cls]
                    if self.passes_threshold(label, conf):
                        detections.append({
                            "class": label,
                            "confidence": round(conf, 4),
                            "bbox": [round(x1), round(y1), round(x2), round(y2)],
                        })
        return detections

    @staticmethod
    def get_top_detection(detections: List[Dict[str, Any]]) -> Tuple[Optional[str], Optional[list]]:
        """Return (class, bbox) of the highest-confidence detection, or (None, None)."""
        if not detections:
            return None, None
        top = max(detections, key=lambda d: d["confidence"])
        return top["class"], top["bbox"]

    def record_telemetry(
        self,
        *,
        frame_index: int,
        timestamp: float,
        capture_ms: float,
        inference_ms: float,
        total_ms: float,
        num_detections: int,
        source_suffix: str = "",
    ) -> None:
        """Record frame telemetry."""
        source = f"{self.source_name}({source_suffix})" if source_suffix else self.source_name
        self.telemetry.record_frame(
            FrameTelemetry(
                frame_index=frame_index,
                timestamp=timestamp,
                capture_ms=capture_ms,
                inference_ms=inference_ms,
                total_ms=total_ms,
                num_detections=num_detections,
                source=source,
            )
        )

    def publish_detection_event(
        self,
        *,
        timestamp: float,
        frame_index: int,
        detections: List[Dict[str, Any]],
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Publish a DetectionEvent to the EventBus."""
        self.event_bus.publish(
            DetectionEvent(
                event_type=EventType.DETECTION,
                source=self.source_name,
                timestamp=timestamp,
                frame_index=frame_index,
                detections=detections,
                data=extra_data or {},
            )
        )

    def log_detections_to_file(
        self,
        *,
        write_fn: Callable[[str], None],
        frame_index: int,
        timestamp: float,
        detections: List[Dict[str, Any]],
        extra_fields: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Serialize detections to JSON and write via the provided callback."""
        try:
            record: Dict[str, Any] = {
                "frame": frame_index,
                "timestamp": timestamp,
                "detections": detections,
            }
            if extra_fields:
                record.update(extra_fields)
            write_fn(json.dumps(record))
        except Exception as e:
            logging.error(f"Error saving detections ({self.source_name}): {e}")

    def detections_to_text(self, detections: List[Dict[str, Any]]) -> Optional[Message]:
        """
        Convert detections to a natural-language Message describing the top detection.

        Uses cam_third to determine spatial direction (left / center / right).
        """
        thing, bbox = self.get_top_detection(detections)
        if thing is None or bbox is None:
            return None
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
