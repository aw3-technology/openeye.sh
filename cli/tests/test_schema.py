"""Tests for Pydantic schema models."""

import pytest
from pydantic import ValidationError

from openeye_ai.schema import BBox, DetectedObject, ImageInfo, PredictionResult


class TestBBox:
    def test_construction(self):
        bbox = BBox(x=0.1, y=0.2, w=0.3, h=0.4)
        assert bbox.x == 0.1
        assert bbox.y == 0.2
        assert bbox.w == 0.3
        assert bbox.h == 0.4

    def test_serialization(self):
        bbox = BBox(x=0.0, y=0.0, w=1.0, h=1.0)
        data = bbox.model_dump()
        assert data == {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}

    def test_zero_values(self):
        bbox = BBox(x=0.0, y=0.0, w=0.0, h=0.0)
        assert bbox.w == 0.0

    def test_negative_values_accepted(self):
        """Pydantic allows negative floats — no validation constraint on range."""
        bbox = BBox(x=-0.5, y=-1.0, w=0.3, h=0.4)
        assert bbox.x == -0.5

    def test_values_above_one_accepted(self):
        """No clamping to [0,1] — raw floats pass through."""
        bbox = BBox(x=1.5, y=2.0, w=3.0, h=4.0)
        assert bbox.x == 1.5

    def test_missing_field_raises(self):
        with pytest.raises(ValidationError):
            BBox(x=0.1, y=0.2, w=0.3)  # missing h

    def test_string_coercion(self):
        """Pydantic coerces numeric strings to float."""
        bbox = BBox(x="0.1", y="0.2", w="0.3", h="0.4")
        assert bbox.x == 0.1

    def test_non_numeric_raises(self):
        with pytest.raises(ValidationError):
            BBox(x="abc", y=0.0, w=0.0, h=0.0)


class TestDetectedObject:
    def test_construction(self):
        obj = DetectedObject(
            label="cat", confidence=0.99, bbox=BBox(x=0, y=0, w=0.5, h=0.5)
        )
        assert obj.label == "cat"
        assert obj.confidence == 0.99

    def test_serialization_roundtrip(self):
        obj = DetectedObject(
            label="dog", confidence=0.8, bbox=BBox(x=0.1, y=0.1, w=0.2, h=0.2)
        )
        data = obj.model_dump()
        restored = DetectedObject(**data)
        assert restored == obj

    def test_empty_label(self):
        obj = DetectedObject(
            label="", confidence=0.5, bbox=BBox(x=0, y=0, w=0.1, h=0.1)
        )
        assert obj.label == ""

    def test_confidence_boundary_zero(self):
        obj = DetectedObject(
            label="x", confidence=0.0, bbox=BBox(x=0, y=0, w=0.1, h=0.1)
        )
        assert obj.confidence == 0.0

    def test_confidence_boundary_one(self):
        obj = DetectedObject(
            label="x", confidence=1.0, bbox=BBox(x=0, y=0, w=0.1, h=0.1)
        )
        assert obj.confidence == 1.0

    def test_missing_bbox_raises(self):
        with pytest.raises(ValidationError):
            DetectedObject(label="cat", confidence=0.9)

    def test_missing_label_raises(self):
        with pytest.raises(ValidationError):
            DetectedObject(confidence=0.9, bbox=BBox(x=0, y=0, w=0.1, h=0.1))


class TestImageInfo:
    def test_construction(self):
        info = ImageInfo(width=640, height=480, source="file.jpg")
        assert info.width == 640

    def test_zero_dimensions(self):
        info = ImageInfo(width=0, height=0, source="empty")
        assert info.width == 0

    def test_empty_source(self):
        info = ImageInfo(width=1, height=1, source="")
        assert info.source == ""

    def test_missing_field_raises(self):
        with pytest.raises(ValidationError):
            ImageInfo(width=640, height=480)  # missing source


class TestPredictionResult:
    def test_defaults(self):
        result = PredictionResult(
            model="test",
            task="detection",
            image=ImageInfo(width=640, height=480, source="test.jpg"),
            inference_ms=10.0,
        )
        assert result.objects == []
        assert result.depth_map is None
        assert result.timestamp  # auto-generated

    def test_with_objects(self):
        result = PredictionResult(
            model="yolov8",
            task="detection",
            image=ImageInfo(width=100, height=100, source="upload"),
            objects=[
                DetectedObject(
                    label="person",
                    confidence=0.95,
                    bbox=BBox(x=0.1, y=0.2, w=0.3, h=0.4),
                )
            ],
            inference_ms=5.5,
        )
        assert len(result.objects) == 1
        assert result.objects[0].label == "person"

    def test_serialization(self):
        result = PredictionResult(
            model="test",
            task="depth",
            image=ImageInfo(width=320, height=240, source="cam"),
            depth_map="base64data",
            inference_ms=20.0,
        )
        data = result.model_dump()
        assert data["model"] == "test"
        assert data["depth_map"] == "base64data"
        assert "timestamp" in data

    def test_missing_required_model_raises(self):
        with pytest.raises(ValidationError):
            PredictionResult(
                task="detection",
                image=ImageInfo(width=1, height=1, source="x"),
                inference_ms=1.0,
            )

    def test_missing_required_inference_ms_raises(self):
        with pytest.raises(ValidationError):
            PredictionResult(
                model="test",
                task="detection",
                image=ImageInfo(width=1, height=1, source="x"),
            )

    def test_timestamp_auto_generated_is_iso_format(self):
        result = PredictionResult(
            model="m",
            task="t",
            image=ImageInfo(width=1, height=1, source="s"),
            inference_ms=0.0,
        )
        assert "T" in result.timestamp  # ISO 8601 contains T separator

    def test_zero_inference_ms(self):
        result = PredictionResult(
            model="m",
            task="t",
            image=ImageInfo(width=1, height=1, source="s"),
            inference_ms=0.0,
        )
        assert result.inference_ms == 0.0

    def test_many_objects(self):
        objects = [
            DetectedObject(
                label=f"obj_{i}",
                confidence=0.5,
                bbox=BBox(x=0, y=0, w=0.1, h=0.1),
            )
            for i in range(100)
        ]
        result = PredictionResult(
            model="m",
            task="t",
            image=ImageInfo(width=1, height=1, source="s"),
            objects=objects,
            inference_ms=1.0,
        )
        assert len(result.objects) == 100

    def test_depth_map_with_empty_objects(self):
        result = PredictionResult(
            model="depth",
            task="depth",
            image=ImageInfo(width=1, height=1, source="s"),
            objects=[],
            depth_map="base64png",
            inference_ms=1.0,
        )
        assert result.depth_map == "base64png"
        assert result.objects == []
