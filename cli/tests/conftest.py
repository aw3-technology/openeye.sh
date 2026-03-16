"""Shared fixtures for CLI tests."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import pytest
from PIL import Image

from openeye_ai.adapters.base import ModelAdapter


# ── Shared test helpers ──────────────────────────────────────────────


def make_test_registry(
    *,
    include_checksum: bool = False,
    include_sam2: bool = False,
    variant_style: str = "none",
) -> dict[str, dict[str, Any]]:
    """Return a fake model registry for CLI tests.

    Parameters
    ----------
    include_checksum:
        Add ``checksum`` fields to yolov8 and its variant (test_install_setup).
    include_sam2:
        Add a ``sam2`` entry (test_run_features segmentation tests).
    variant_style:
        ``"quantized"`` — yolov8 variant named ``quantized`` (install/cli tests).
        ``"format"``    — yolov8 variants ``onnx`` + ``tensorrt`` (run-features tests).
        ``"none"``      — no variants at all.
    """
    yolov8: dict[str, Any] = {
        "name": "YOLOv8",
        "task": "detection",
        "adapter": "yolov8",
        "description": "Object detection",
        "hf_repo": "ultralytics/yolov8",
        "filename": "yolov8n.pt",
        "size_mb": 6 if include_checksum else 25,
        "hardware": {"cpu": True},
    }

    if include_checksum:
        yolov8["checksum"] = {
            "algorithm": "sha256",
            "value": "abc123" * 10 + "abcd",
        }

    if variant_style == "quantized":
        variant: dict[str, Any] = {
            "filename": "yolov8n_int8.onnx" if include_checksum else "yolov8n_int8.pt",
            "size_mb": 3 if include_checksum else 10,
        }
        if include_checksum:
            variant["adapter"] = "yolov8:onnx"
            variant["checksum"] = {
                "algorithm": "sha256",
                "value": "def456" * 10 + "defg",
            }
        yolov8["variants"] = {"quantized": variant}
    elif variant_style == "format":
        yolov8["adapter"] = "yolo"
        yolov8["variants"] = {
            "onnx": {"filename": "yolov8n.onnx", "size_mb": 12, "adapter": "yolov8:onnx"},
            "tensorrt": {"filename": "yolov8n.engine", "size_mb": 15, "adapter": "yolov8:tensorrt"},
        }

    # Non-quantized style also uses "yolo" adapter key
    if variant_style in ("format", "none"):
        yolov8["adapter"] = "yolo"

    registry: dict[str, dict[str, Any]] = {"yolov8": yolov8}

    registry["depth-anything"] = {
        "name": "Depth Anything",
        "task": "depth",
        "adapter": "depth_anything",
        "description": "Monocular depth estimation" if include_checksum else "Monocular depth",
        "hf_repo": "depth/anything",
        "filename": "depth.pt",
        "size_mb": 98 if include_checksum else 50,
        "hardware": {"cpu": True, "cuda": True} if include_checksum else {"cpu": True},
    }

    registry["grounding-dino"] = {
        "name": "Grounding DINO",
        "task": "detection",
        "adapter": "grounding_dino",
        "description": "Open-vocab detection",
        "hf_repo": "grounding/dino",
        "filename": "grounding.pt" if include_checksum else "gdino.pt",
        "size_mb": 341 if include_checksum else 100,
    }

    if include_sam2:
        registry["sam2"] = {
            "name": "SAM2",
            "task": "segmentation",
            "adapter": "sam2",
            "description": "Segmentation",
            "hf_repo": "sam/sam2",
            "filename": "sam2.pt",
            "size_mb": 200,
        }

    return registry


class StubAdapter:
    """Configurable adapter stub for CLI tests.

    Parameters
    ----------
    detections:
        Detection list to return from ``predict()``.
        Default: single person detection.  Pass ``[]`` for benchmark tests.
    track_pulls:
        If a list is provided, ``pull()`` appends ``model_dir.name`` to it.
    fail_on:
        If set, ``pull()`` raises ``RuntimeError`` when the model dir path
        contains this substring.
    """

    def __init__(
        self,
        *,
        detections: list[dict[str, Any]] | None = None,
        inference_ms: float = 5.0,
        track_pulls: list[str] | None = None,
        fail_on: str | None = None,
    ):
        self._detections = detections if detections is not None else [
            {"label": "person", "confidence": 0.9, "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}}
        ]
        self._inference_ms = inference_ms
        self._track_pulls = track_pulls
        self._fail_on = fail_on

    def pull(self, model_dir: Path) -> None:
        if self._fail_on and self._fail_on in str(model_dir):
            raise RuntimeError("Download error")
        if self._track_pulls is not None:
            self._track_pulls.append(str(model_dir))
        model_dir.mkdir(parents=True, exist_ok=True)

    def load(self, model_dir: Path) -> None:
        pass

    def predict(self, image: Any) -> dict:
        return {
            "objects": self._detections,
            "inference_ms": self._inference_ms,
        }


@pytest.fixture()
def patch_disk_space(monkeypatch):
    """Patch disk_usage to report plenty of free space."""
    monkeypatch.setattr(
        "shutil.disk_usage",
        lambda p: shutil._ntuple_diskusage(100 * 1024**3, 50 * 1024**3, 50 * 1024**3),
    )


class FakeAdapter(ModelAdapter):
    """No-op adapter for testing — returns canned detection data."""

    def _do_load(self, model_dir: Path) -> None:
        pass

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        w, h = image.size
        return {
            "objects": [
                {
                    "label": "person",
                    "confidence": 0.95,
                    "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4},
                }
            ],
            "inference_ms": 1.23,
        }

    def pull(self, model_dir: Path) -> None:
        model_dir.mkdir(parents=True, exist_ok=True)


@pytest.fixture()
def fake_adapter():
    """Return a loaded FakeAdapter."""
    adapter = FakeAdapter()
    adapter.load(Path("/tmp/fake_model"))
    return adapter


@pytest.fixture()
def tmp_openeye_home(tmp_path, monkeypatch):
    """Redirect OPENEYE_HOME and MODELS_DIR to a temp directory."""
    home = tmp_path / ".openeye"
    models = home / "models"
    monkeypatch.setattr("openeye_ai.config.OPENEYE_HOME", home)
    monkeypatch.setattr("openeye_ai.config.MODELS_DIR", models)
    monkeypatch.setattr("openeye_ai.config.CONFIG_PATH", home / "config.yaml")
    return home


@pytest.fixture()
def app_client(fake_adapter):
    """Return a TestClient wrapping the FastAPI app with a FakeAdapter."""
    from starlette.testclient import TestClient

    from openeye_ai.server.app import create_app
    from openeye_ai.server.rate_limit import limiter

    # Reset rate limiter state between tests
    limiter.reset()

    model_info = {"name": "FakeModel", "task": "detection"}
    app = create_app(fake_adapter, "fake-model", model_info)
    return TestClient(app)


@pytest.fixture()
def tiny_image_bytes():
    """Return bytes of a small 10x10 red JPEG."""
    import io

    img = Image.new("RGB", (10, 10), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class FakeCamera:
    """Minimal camera stub that returns a 10x10 PIL image."""

    def __init__(self, frames: int | None = None):
        self._frames = frames
        self._count = 0

    def read_pil(self) -> Image.Image | None:
        if self._frames is not None and self._count >= self._frames:
            return None
        self._count += 1
        return Image.new("RGB", (10, 10), color="blue")


@pytest.fixture()
def fake_camera():
    """Return a FakeCamera that produces unlimited frames."""
    return FakeCamera()


@pytest.fixture()
def memory_store(tmp_path):
    """Return an ObservationMemoryStore backed by a temp JSONL file."""
    from openeye_ai.memory.store import ObservationMemoryStore

    return ObservationMemoryStore(path=tmp_path / "obs.jsonl")
