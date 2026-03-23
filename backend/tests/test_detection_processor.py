"""Tests for the DetectionProcessor shared utility."""

import time
from unittest.mock import MagicMock, call

import pytest

from inputs.plugins.detection_processor import DetectionProcessor
from providers.event_bus import DetectionEvent, EventType
from providers.telemetry_provider import FrameTelemetry


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def event_bus():
    bus = MagicMock()
    return bus


@pytest.fixture()
def telemetry():
    tel = MagicMock()
    return tel


@pytest.fixture()
def processor(event_bus, telemetry):
    return DetectionProcessor(
        event_bus=event_bus,
        telemetry=telemetry,
        confidence_thresholds={"person": 0.6, "car": 0.4},
        default_confidence=0.25,
        source_name="TestPlugin",
        cam_third=200,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_box(xyxy, cls, conf):
    """Create a mock YOLO box."""
    import torch

    box = MagicMock()
    box.xyxy = [torch.tensor(xyxy)]
    box.cls = [torch.tensor(cls)]
    box.conf = [torch.tensor(conf)]
    return box


def _make_result(boxes):
    """Create a mock YOLO result object."""
    result = MagicMock()
    result.boxes = boxes
    return result


MODEL_NAMES = {0: "person", 1: "car", 2: "dog"}


# ---------------------------------------------------------------------------
# Tests: passes_threshold
# ---------------------------------------------------------------------------


class TestPassesThreshold:
    def test_uses_per_class_threshold(self, processor):
        # person threshold is 0.6
        assert processor.passes_threshold("person", 0.7) is True
        assert processor.passes_threshold("person", 0.5) is False

    def test_uses_default_for_unlisted_class(self, processor):
        # default is 0.25
        assert processor.passes_threshold("dog", 0.3) is True
        assert processor.passes_threshold("dog", 0.1) is False

    def test_exact_threshold_passes(self, processor):
        assert processor.passes_threshold("car", 0.4) is True


# ---------------------------------------------------------------------------
# Tests: extract_detections
# ---------------------------------------------------------------------------


class TestExtractDetections:
    def test_extracts_from_yolo_results(self, processor):
        try:
            import torch
        except ImportError:
            pytest.skip("torch not installed")

        boxes = [_make_box([10.0, 20.0, 100.0, 200.0], 0, 0.9)]
        results = [_make_result(boxes)]

        detections = processor.extract_detections(results, MODEL_NAMES)

        assert len(detections) == 1
        assert detections[0]["class"] == "person"
        assert detections[0]["confidence"] == 0.9
        assert detections[0]["bbox"] == [10, 20, 100, 200]

    def test_filters_below_threshold(self, processor):
        try:
            import torch
        except ImportError:
            pytest.skip("torch not installed")

        # person at 0.3 is below 0.6 threshold
        boxes = [_make_box([10.0, 20.0, 100.0, 200.0], 0, 0.3)]
        results = [_make_result(boxes)]

        detections = processor.extract_detections(results, MODEL_NAMES)
        assert len(detections) == 0

    def test_handles_no_boxes(self, processor):
        result = MagicMock()
        result.boxes = None
        detections = processor.extract_detections([result], MODEL_NAMES)
        assert detections == []

    def test_handles_empty_results(self, processor):
        detections = processor.extract_detections([], MODEL_NAMES)
        assert detections == []


# ---------------------------------------------------------------------------
# Tests: get_top_detection
# ---------------------------------------------------------------------------


class TestGetTopDetection:
    def test_returns_highest_confidence(self):
        detections = [
            {"class": "person", "confidence": 0.7, "bbox": [0, 0, 50, 50]},
            {"class": "car", "confidence": 0.9, "bbox": [100, 100, 200, 200]},
        ]
        cls, bbox = DetectionProcessor.get_top_detection(detections)
        assert cls == "car"
        assert bbox == [100, 100, 200, 200]

    def test_returns_none_for_empty(self):
        cls, bbox = DetectionProcessor.get_top_detection([])
        assert cls is None
        assert bbox is None


# ---------------------------------------------------------------------------
# Tests: record_telemetry
# ---------------------------------------------------------------------------


class TestRecordTelemetry:
    def test_records_frame_telemetry(self, processor, telemetry):
        processor.record_telemetry(
            frame_index=42,
            timestamp=1000.0,
            capture_ms=5.0,
            inference_ms=15.0,
            total_ms=20.0,
            num_detections=3,
        )
        telemetry.record_frame.assert_called_once()
        ft = telemetry.record_frame.call_args[0][0]
        assert ft.frame_index == 42
        assert ft.source == "TestPlugin"

    def test_appends_source_suffix(self, processor, telemetry):
        processor.record_telemetry(
            frame_index=1,
            timestamp=1.0,
            capture_ms=1.0,
            inference_ms=1.0,
            total_ms=2.0,
            num_detections=0,
            source_suffix="clip.mp4",
        )
        ft = telemetry.record_frame.call_args[0][0]
        assert ft.source == "TestPlugin(clip.mp4)"


# ---------------------------------------------------------------------------
# Tests: publish_detection_event
# ---------------------------------------------------------------------------


class TestPublishDetectionEvent:
    def test_publishes_to_event_bus(self, processor, event_bus):
        dets = [{"class": "car", "confidence": 0.9, "bbox": [0, 0, 1, 1]}]
        processor.publish_detection_event(
            timestamp=1.0,
            frame_index=10,
            detections=dets,
            extra_data={"fps": 30},
        )
        event_bus.publish.assert_called_once()
        evt = event_bus.publish.call_args[0][0]
        assert isinstance(evt, DetectionEvent)
        assert evt.source == "TestPlugin"
        assert evt.detections == dets
        assert evt.data == {"fps": 30}


# ---------------------------------------------------------------------------
# Tests: log_detections_to_file
# ---------------------------------------------------------------------------


class TestLogDetectionsToFile:
    def test_calls_write_fn_with_json(self, processor):
        write_fn = MagicMock()
        processor.log_detections_to_file(
            write_fn=write_fn,
            frame_index=5,
            timestamp=1000.0,
            detections=[{"class": "dog", "confidence": 0.8, "bbox": [0, 0, 1, 1]}],
        )
        write_fn.assert_called_once()
        import json

        data = json.loads(write_fn.call_args[0][0])
        assert data["frame"] == 5
        assert len(data["detections"]) == 1

    def test_includes_extra_fields(self, processor):
        write_fn = MagicMock()
        processor.log_detections_to_file(
            write_fn=write_fn,
            frame_index=1,
            timestamp=1.0,
            detections=[],
            extra_fields={"progress": 50.0},
        )
        import json

        data = json.loads(write_fn.call_args[0][0])
        assert data["progress"] == 50.0

    def test_handles_write_error_gracefully(self, processor, caplog):
        def exploding_write(_):
            raise IOError("disk full")

        processor.log_detections_to_file(
            write_fn=exploding_write,
            frame_index=1,
            timestamp=1.0,
            detections=[],
        )
        assert "disk full" in caplog.text


# ---------------------------------------------------------------------------
# Tests: detections_to_text
# ---------------------------------------------------------------------------


class TestDetectionsToText:
    def test_left_direction(self, processor):
        # cam_third = 200, so center_x < 200 → left
        dets = [{"class": "person", "confidence": 0.9, "bbox": [50, 0, 100, 100]}]
        msg = processor.detections_to_text(dets)
        assert msg is not None
        assert "on your left" in msg.message

    def test_right_direction(self, processor):
        # center_x > 400 → right
        dets = [{"class": "car", "confidence": 0.9, "bbox": [450, 0, 500, 100]}]
        msg = processor.detections_to_text(dets)
        assert "on your right" in msg.message

    def test_center_direction(self, processor):
        # 200 < center_x < 400 → in front
        dets = [{"class": "dog", "confidence": 0.8, "bbox": [250, 0, 350, 100]}]
        msg = processor.detections_to_text(dets)
        assert "in front of you" in msg.message

    def test_returns_none_for_empty(self, processor):
        assert processor.detections_to_text([]) is None
