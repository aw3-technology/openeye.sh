"""Tests for run command features: stories 9-22."""

from __future__ import annotations

import base64
import io
import json
import sys
from pathlib import Path
from typing import Any

import pytest
from PIL import Image
from typer.testing import CliRunner

from openeye_ai.cli import app

runner = CliRunner()


# ── Helpers ──────────────────────────────────────────────────────────


def _make_registry() -> dict[str, dict[str, Any]]:
    return {
        "yolov8": {
            "name": "YOLOv8",
            "task": "detection",
            "adapter": "yolo",
            "description": "Object detection",
            "hf_repo": "ultralytics/yolov8",
            "filename": "yolov8n.pt",
            "size_mb": 25,
            "hardware": {"cpu": True},
            "variants": {
                "onnx": {"filename": "yolov8n.onnx", "size_mb": 12, "adapter": "yolov8:onnx"},
                "tensorrt": {"filename": "yolov8n.engine", "size_mb": 15, "adapter": "yolov8:tensorrt"},
            },
        },
        "depth-anything": {
            "name": "Depth Anything",
            "task": "depth",
            "adapter": "depth_anything",
            "description": "Monocular depth",
            "hf_repo": "depth/anything",
            "filename": "depth.pt",
            "size_mb": 50,
        },
        "grounding-dino": {
            "name": "Grounding DINO",
            "task": "detection",
            "adapter": "grounding_dino",
            "description": "Open-vocab detection",
            "hf_repo": "grounding/dino",
            "filename": "gdino.pt",
            "size_mb": 100,
        },
        "sam2": {
            "name": "SAM2",
            "task": "segmentation",
            "adapter": "sam2",
            "description": "Segmentation",
            "hf_repo": "sam/sam2",
            "filename": "sam2.pt",
            "size_mb": 200,
        },
    }


def _make_jpeg(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (100, 100), color="red")
    img.save(path, format="JPEG")
    return path


def _jpeg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color="blue").save(buf, format="JPEG")
    return buf.getvalue()


def _fake_depth_b64() -> str:
    buf = io.BytesIO()
    Image.new("L", (10, 10), color=128).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _fake_mask_b64() -> str:
    buf = io.BytesIO()
    Image.new("L", (10, 10), color=255).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class _DetectionAdapter:
    def load(self, model_dir): pass

    def predict(self, image):
        return {
            "objects": [
                {"label": "person", "confidence": 0.95, "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}},
                {"label": "car", "confidence": 0.72, "bbox": {"x": 0.5, "y": 0.3, "w": 0.2, "h": 0.3}},
                {"label": "dog", "confidence": 0.45, "bbox": {"x": 0.7, "y": 0.6, "w": 0.1, "h": 0.15}},
            ],
            "inference_ms": 12.3,
        }


class _DepthAdapter:
    def load(self, model_dir): pass

    def predict(self, image):
        return {"depth_map": _fake_depth_b64(), "inference_ms": 8.5}


class _PromptAdapter:
    def load(self, model_dir): pass

    def predict(self, image):
        return {"objects": [], "inference_ms": 5.0}

    def predict_with_prompt(self, image, prompt):
        return {
            "objects": [
                {"label": prompt, "confidence": 0.88, "bbox": {"x": 0.2, "y": 0.1, "w": 0.4, "h": 0.5}},
            ],
            "inference_ms": 15.0,
        }


class _SegmentationAdapter:
    def load(self, model_dir): pass

    def predict(self, image):
        return {
            "segmentation_masks": [
                {"mask": _fake_mask_b64(), "area": 500, "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}, "stability_score": 0.98},
                {"mask": _fake_mask_b64(), "area": 200, "bbox": {"x": 0.5, "y": 0.3, "w": 0.2, "h": 0.3}, "stability_score": 0.85},
            ],
            "inference_ms": 25.0,
        }


def _get_run_mod():
    import openeye_ai.commands.inference.run  # noqa: F811
    return sys.modules["openeye_ai.commands.inference.run"]


def _patch_run(monkeypatch, registry, adapter_cls, model="yolov8"):
    run_mod = _get_run_mod()
    monkeypatch.setattr(run_mod, "get_model_info", lambda m: registry[m])
    monkeypatch.setattr(run_mod, "is_downloaded", lambda m: True)
    monkeypatch.setattr(run_mod, "get_adapter", lambda m, variant=None: adapter_cls())
    monkeypatch.setattr(run_mod, "MODELS_DIR", Path("/tmp/fake_models"))


def _patch_run_variant(monkeypatch, registry, adapter_cls):
    run_mod = _get_run_mod()
    monkeypatch.setattr(run_mod, "get_model_info", lambda m: registry[m])
    monkeypatch.setattr(run_mod, "get_variant_info", lambda m, v: {**registry[m], "_variant": v})
    monkeypatch.setattr(run_mod, "is_downloaded", lambda m: True)
    monkeypatch.setattr(run_mod, "is_variant_downloaded", lambda m, v: True)
    monkeypatch.setattr(run_mod, "get_adapter", lambda m, variant=None: adapter_cls())
    monkeypatch.setattr(run_mod, "MODELS_DIR", Path("/tmp/fake_models"))


# ── Story 9: Basic JSON output ──────────────────────────────────────


class TestStory9_BasicJSON:
    def test_json_to_stdout(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "yolov8", str(img)])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert data["model"] == "yolov8"
        assert data["task"] == "detection"
        assert len(data["objects"]) == 3
        assert data["objects"][0]["label"] == "person"
        assert data["objects"][0]["confidence"] == 0.95
        assert "bbox" in data["objects"][0]
        assert isinstance(data["inference_ms"], float)
        assert data["image"]["source"] == str(img)
        assert data["image"]["width"] == 100
        assert data["image"]["height"] == 100
        assert "timestamp" in data


# ── Story 10: Stdin pipe raw image ──────────────────────────────────


class TestStory10_StdinPipe:
    def test_pipe_raw_image_bytes(self, tmp_openeye_home, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)

        img_bytes = _jpeg_bytes()
        result = runner.invoke(app, ["run", "yolov8", "-"], input=img_bytes)
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert data["model"] == "yolov8"
        assert len(data["objects"]) == 3

    def test_pipe_json_from_previous_run(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DepthAdapter, model="depth-anything")
        img = _make_jpeg(tmp_path / "photo.jpg")

        upstream = json.dumps({
            "model": "yolov8",
            "task": "detection",
            "image": {"width": 100, "height": 100, "source": str(img)},
            "objects": [{"label": "person", "confidence": 0.9, "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}}],
            "inference_ms": 5.0,
        })

        result = runner.invoke(app, ["run", "depth-anything", "-"], input=upstream)
        assert result.exit_code == 0
        data = json.loads(result.output)
        # Should have depth map from depth-anything and objects from upstream
        assert data["depth_map"] is not None


# ── Story 11: Pretty human-readable output ──────────────────────────


class TestStory11_PrettyOutput:
    def test_pretty_flag(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "yolov8", str(img), "--pretty"])
        assert result.exit_code == 0
        output = result.output
        # Output contains human-readable pretty text (via stderr, merged by CliRunner)
        assert "Detections (3)" in output or "yolov8" in output
        # Also contains JSON (stdout)
        assert '"model"' in output or '"person"' in output


# ── Story 12: File output ───────────────────────────────────────────


class TestStory12_FileOutput:
    def test_output_to_file(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")
        out_file = tmp_path / "results.json"

        result = runner.invoke(app, ["run", "yolov8", str(img), "-o", str(out_file)])
        assert result.exit_code == 0
        assert out_file.exists()
        data = json.loads(out_file.read_text())
        assert data["model"] == "yolov8"
        assert len(data["objects"]) == 3

    def test_output_creates_parent_dirs(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")
        out_file = tmp_path / "nested" / "dir" / "results.json"

        result = runner.invoke(app, ["run", "yolov8", str(img), "-o", str(out_file)])
        assert result.exit_code == 0
        assert out_file.exists()


# ── Story 13: Visualize bounding boxes ──────────────────────────────


class TestStory13_Visualize:
    def test_visualize_detections(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "yolov8", str(img), "--visualize"])
        assert result.exit_code == 0
        annotated = tmp_path / "photo_annotated.png"
        assert annotated.exists()

    def test_visualize_depth_map(self, tmp_openeye_home, tmp_path, monkeypatch):
        registry = _make_registry()
        _patch_run(monkeypatch, registry, _DepthAdapter, model="depth-anything")
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "depth-anything", str(img), "--visualize"])
        assert result.exit_code == 0
        depth = tmp_path / "photo_depth.png"
        assert depth.exists()


# ── Story 14: Open-vocabulary detection with prompt ─────────────────


class TestStory14_PromptDetection:
    def test_grounding_dino_prompt(self, tmp_openeye_home, tmp_path, monkeypatch):
        registry = _make_registry()
        _patch_run(monkeypatch, registry, _PromptAdapter, model="grounding-dino")
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "grounding-dino", str(img), "-p", "red forklift"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert data["objects"][0]["label"] == "red forklift"


# ── Story 15: Depth map output ──────────────────────────────────────


class TestStory15_DepthMap:
    def test_depth_anything_output(self, tmp_openeye_home, tmp_path, monkeypatch):
        registry = _make_registry()
        _patch_run(monkeypatch, registry, _DepthAdapter, model="depth-anything")
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "depth-anything", str(img)])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert data["depth_map"] is not None
        assert data["task"] == "depth"


# ── Story 16: Segmentation masks ────────────────────────────────────


class TestStory16_Segmentation:
    def test_sam2_masks(self, tmp_openeye_home, tmp_path, monkeypatch):
        registry = _make_registry()
        _patch_run(monkeypatch, registry, _SegmentationAdapter, model="sam2")
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "sam2", str(img)])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert data["segmentation_masks"] is not None
        assert len(data["segmentation_masks"]) == 2
        assert data["segmentation_masks"][0]["area"] == 500
        assert data["segmentation_masks"][0]["stability_score"] == 0.98

    def test_sam2_visualize_masks(self, tmp_openeye_home, tmp_path, monkeypatch):
        registry = _make_registry()
        _patch_run(monkeypatch, registry, _SegmentationAdapter, model="sam2")
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "sam2", str(img), "--visualize"])
        assert result.exit_code == 0
        masks_path = tmp_path / "photo_masks.png"
        assert masks_path.exists()


# ── Story 17: ONNX backend ─────────────────────────────────────────


class TestStory17_OnnxBackend:
    def test_backend_onnx(self, tmp_openeye_home, tmp_path, monkeypatch):
        registry = _make_registry()
        _patch_run_variant(monkeypatch, registry, _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "yolov8", str(img), "--backend", "onnx"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert data["model"] == "yolov8"


# ── Story 18: TensorRT backend ─────────────────────────────────────


class TestStory18_TensorRTBackend:
    def test_backend_tensorrt(self, tmp_openeye_home, tmp_path, monkeypatch):
        registry = _make_registry()
        _patch_run_variant(monkeypatch, registry, _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "yolov8", str(img), "--backend", "tensorrt"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert data["model"] == "yolov8"


# ── Story 19: Pipeline composition ──────────────────────────────────


class TestStory19_PipelineComposition:
    def test_merge_upstream_objects(self, tmp_openeye_home, tmp_path, monkeypatch):
        """Depth model should inherit objects from upstream detection."""
        registry = _make_registry()
        _patch_run(monkeypatch, registry, _DepthAdapter, model="depth-anything")
        img = _make_jpeg(tmp_path / "photo.jpg")

        upstream = json.dumps({
            "model": "yolov8",
            "task": "detection",
            "image": {"width": 100, "height": 100, "source": str(img)},
            "objects": [
                {"label": "person", "confidence": 0.9, "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}}
            ],
            "depth_map": None,
            "inference_ms": 5.0,
        })

        result = runner.invoke(app, ["run", "depth-anything", "-"], input=upstream)
        assert result.exit_code == 0
        data = json.loads(result.output)
        # Should have depth from current model AND objects from upstream
        assert data["depth_map"] is not None
        assert len(data["objects"]) == 1
        assert data["objects"][0]["label"] == "person"
        # Model should show pipeline provenance
        assert "yolov8+depth-anything" in data["model"]

    def test_pipeline_preserves_current_over_upstream(self, tmp_openeye_home, tmp_path, monkeypatch):
        """Current model results take precedence over upstream."""
        registry = _make_registry()
        _patch_run(monkeypatch, registry, _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        upstream = json.dumps({
            "model": "other",
            "task": "detection",
            "image": {"width": 100, "height": 100, "source": str(img)},
            "objects": [
                {"label": "upstream_obj", "confidence": 0.5, "bbox": {"x": 0, "y": 0, "w": 0.1, "h": 0.1}}
            ],
            "inference_ms": 1.0,
        })

        result = runner.invoke(app, ["run", "yolov8", "-"], input=upstream)
        assert result.exit_code == 0
        data = json.loads(result.output)
        # Current model's detections should be kept (not upstream's)
        assert data["objects"][0]["label"] == "person"
        assert len(data["objects"]) == 3


# ── Story 20: Error for unpulled model ──────────────────────────────


class TestStory20_UnpulledModelError:
    def test_clear_error_with_pull_command(self, tmp_openeye_home, monkeypatch):
        run_mod = _get_run_mod()
        registry = _make_registry()
        monkeypatch.setattr(run_mod, "get_model_info", lambda m: registry[m])
        monkeypatch.setattr(run_mod, "is_downloaded", lambda m: False)
        monkeypatch.setattr(run_mod, "MODELS_DIR", Path("/tmp/fake_models"))

        result = runner.invoke(app, ["run", "yolov8", "/tmp/fake.jpg"])
        assert result.exit_code == 1
        assert "not downloaded" in result.output
        assert "openeye pull yolov8" in result.output

    def test_unknown_model_error(self, tmp_openeye_home, monkeypatch):
        run_mod = _get_run_mod()
        monkeypatch.setattr(
            run_mod, "get_model_info",
            lambda m: (_ for _ in ()).throw(KeyError(f"Unknown model '{m}'")),
        )

        result = runner.invoke(app, ["run", "nonexistent", "/tmp/fake.jpg"])
        assert result.exit_code == 1
        assert "Unknown model" in result.output

    def test_unpulled_variant_error(self, tmp_openeye_home, monkeypatch):
        run_mod = _get_run_mod()
        registry = _make_registry()
        monkeypatch.setattr(run_mod, "get_model_info", lambda m: registry[m])
        monkeypatch.setattr(run_mod, "get_variant_info", lambda m, v: {**registry[m], "_variant": v})
        monkeypatch.setattr(run_mod, "is_variant_downloaded", lambda m, v: False)
        monkeypatch.setattr(run_mod, "MODELS_DIR", Path("/tmp/fake_models"))

        result = runner.invoke(app, ["run", "yolov8", "/tmp/fake.jpg", "--backend", "onnx"])
        assert result.exit_code == 1
        assert "not downloaded" in result.output
        assert "openeye pull yolov8 --variant onnx" in result.output


# ── Story 21: Batch/directory processing ─────────────────────────────


def _extract_json(output: str):
    """Extract JSON from mixed stdout/stderr output (CliRunner merges them)."""
    # Look for JSON array starting with [{ (not Rich markup like [dim])
    idx = output.find("[{")
    if idx >= 0:
        ridx = output.rfind("}]")
        if ridx > idx:
            try:
                return json.loads(output[idx : ridx + 2])
            except json.JSONDecodeError:
                pass
    # Fallback: try to find a JSON object
    idx = output.find("{")
    if idx >= 0:
        ridx = output.rfind("}")
        if ridx > idx:
            try:
                return json.loads(output[idx : ridx + 1])
            except json.JSONDecodeError:
                pass
    return json.loads(output)


class TestStory21_BatchDirectory:
    def test_directory_batch(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img_dir = tmp_path / "images"
        img_dir.mkdir()
        _make_jpeg(img_dir / "a.jpg")
        _make_jpeg(img_dir / "b.jpg")
        _make_jpeg(img_dir / "c.png")

        result = runner.invoke(app, ["run", "yolov8", str(img_dir)])
        assert result.exit_code == 0
        data = _extract_json(result.output)
        assert isinstance(data, list)
        assert len(data) == 3
        for item in data:
            assert item["model"] == "yolov8"
            assert len(item["objects"]) == 3

    def test_empty_directory_error(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()

        result = runner.invoke(app, ["run", "yolov8", str(empty_dir)])
        assert result.exit_code == 1
        assert "No image files found" in result.output

    def test_directory_skips_non_images(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img_dir = tmp_path / "images"
        img_dir.mkdir()
        _make_jpeg(img_dir / "good.jpg")
        (img_dir / "readme.txt").write_text("not an image")
        (img_dir / "data.csv").write_text("1,2,3")

        result = runner.invoke(app, ["run", "yolov8", str(img_dir)])
        assert result.exit_code == 0
        data = _extract_json(result.output)
        assert isinstance(data, list)
        assert len(data) == 1

    def test_directory_output_to_file(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img_dir = tmp_path / "images"
        img_dir.mkdir()
        _make_jpeg(img_dir / "a.jpg")
        _make_jpeg(img_dir / "b.jpg")
        out_file = tmp_path / "batch.json"

        result = runner.invoke(app, ["run", "yolov8", str(img_dir), "-o", str(out_file)])
        assert result.exit_code == 0
        assert out_file.exists()
        data = json.loads(out_file.read_text())
        assert isinstance(data, list)
        assert len(data) == 2


# ── Story 22: Confidence filtering ──────────────────────────────────


class TestStory22_ConfidenceFilter:
    def test_confidence_filter(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "yolov8", str(img), "--confidence", "0.7"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        # person=0.95, car=0.72 should pass; dog=0.45 should be filtered
        assert len(data["objects"]) == 2
        labels = {o["label"] for o in data["objects"]}
        assert "person" in labels
        assert "car" in labels
        assert "dog" not in labels

    def test_confidence_filter_all(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "yolov8", str(img), "--confidence", "0.99"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert len(data["objects"]) == 0

    def test_confidence_filter_none_filtered(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "yolov8", str(img), "--confidence", "0.1"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert len(data["objects"]) == 3

    def test_confidence_with_short_flag(self, tmp_openeye_home, tmp_path, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        img = _make_jpeg(tmp_path / "photo.jpg")

        result = runner.invoke(app, ["run", "yolov8", str(img), "-c", "0.7"])
        assert result.exit_code == 0
        data = json.loads(result.output)
        assert len(data["objects"]) == 2


# ── Visualization tests ─────────────────────────────────────────────


class TestVisualization:
    def test_draw_boxes(self, tmp_path):
        from openeye_ai.utils.visualize import draw_boxes
        img = Image.new("RGB", (100, 100), "white")
        objects = [
            {"label": "test", "confidence": 0.9, "bbox": {"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5}},
        ]
        result = draw_boxes(img, objects)
        assert result.size == (100, 100)

    def test_draw_masks(self, tmp_path):
        from openeye_ai.utils.visualize import draw_masks
        img = Image.new("RGB", (10, 10), "white")
        masks = [
            {"mask": _fake_mask_b64(), "area": 100, "bbox": {"x": 0, "y": 0, "w": 1, "h": 1}, "stability_score": 0.9},
        ]
        result = draw_masks(img, masks)
        assert result.size == (10, 10)
        assert result.mode == "RGB"

    def test_save_depth_map(self, tmp_path):
        from openeye_ai.utils.visualize import save_depth_map
        out = tmp_path / "depth.png"
        save_depth_map(_fake_depth_b64(), out)
        assert out.exists()
        img = Image.open(out)
        assert img.size == (10, 10)


# ── Edge cases ──────────────────────────────────────────────────────


class TestEdgeCases:
    def test_no_image_no_stdin(self, tmp_openeye_home, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        # CliRunner provides empty stdin (not a tty), so we get the empty-stdin error
        result = runner.invoke(app, ["run", "yolov8"])
        assert result.exit_code == 1
        assert "No data received" in result.output or "No image provided" in result.output

    def test_image_not_found(self, tmp_openeye_home, monkeypatch):
        _patch_run(monkeypatch, _make_registry(), _DetectionAdapter)
        result = runner.invoke(app, ["run", "yolov8", "/nonexistent/photo.jpg"])
        assert result.exit_code == 1
        assert "not found" in result.output
