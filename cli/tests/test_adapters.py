"""Unit tests for all 10 model adapter implementations.

Each adapter's external dependencies (ultralytics, transformers, onnxruntime, etc.)
are mocked to test adapter logic without requiring model weights.
"""

from __future__ import annotations

import base64
import importlib
import io
import sys
import time
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from PIL import Image

from openeye_ai.adapters.base import ModelAdapter, ModelNotLoadedError


# ── Helpers ──────────────────────────────────────────────────────────


def _rgb_image(w: int = 100, h: int = 80) -> Image.Image:
    return Image.new("RGB", (w, h), color="blue")


def _assert_detection_result(result: dict) -> None:
    assert "objects" in result
    assert "inference_ms" in result
    assert isinstance(result["objects"], list)
    assert isinstance(result["inference_ms"], (int, float))
    assert result["inference_ms"] >= 0


def _assert_bbox_normalized(bbox: dict) -> None:
    for key in ("x", "y", "w", "h"):
        assert 0 <= bbox[key] <= 1.1, f"bbox[{key}] = {bbox[key]} out of range"


# ── Fake ultralytics result ──────────────────────────────────────────


class _FakeTensor:
    """Minimal tensor substitute that supports tolist(), indexing, len()."""

    def __init__(self, data):
        self._data = np.array(data, dtype=np.float32) if len(data) else np.zeros((0,), dtype=np.float32)

    def __len__(self):
        return len(self._data)

    def __getitem__(self, idx):
        val = self._data[idx]
        return _FakeTensor(val) if isinstance(val, np.ndarray) else val

    def tolist(self):
        return self._data.tolist()


class _FakeBoxes:
    def __init__(self, detections: list[tuple[list[float], float, int]]):
        xyxy, confs, classes = [], [], []
        for (x1, y1, x2, y2), conf, cls in detections:
            xyxy.append([x1, y1, x2, y2])
            confs.append(conf)
            classes.append(cls)
        self.xyxy = _FakeTensor(xyxy) if xyxy else _FakeTensor([])
        self.conf = _FakeTensor(confs) if confs else _FakeTensor([])
        self.cls = _FakeTensor(classes) if classes else _FakeTensor([])

    def __len__(self):
        return len(self.conf)


class _FakeYOLOResult:
    def __init__(self, detections, names):
        self.boxes = _FakeBoxes(detections)
        self.names = names


def _mock_ultralytics(detections=None, names=None):
    """Return a mock YOLO class that produces fake results."""
    if detections is None:
        detections = [([10, 20, 50, 80], 0.92, 0), ([30, 10, 70, 60], 0.85, 1)]
    if names is None:
        names = {0: "person", 1: "car"}
    fake_result = _FakeYOLOResult(detections, names)
    mock_model = MagicMock()
    mock_model.return_value = [fake_result]
    mock_yolo_cls = MagicMock(return_value=mock_model)
    mock_yolo_cls.return_value = mock_model
    # For pull() — need ckpt_path
    mock_model.ckpt_path = "/tmp/fake_weights.pt"
    return mock_yolo_cls, mock_model


# ── YOLOv8 Adapter Tests ────────────────────────────────────────────


class TestYOLOv8Adapter:
    def _load_adapter_with_mock(self, tmp_path, detections=None, names=None):
        """Load the adapter with mocked ultralytics."""
        weights = tmp_path / "yolov8n.pt"
        weights.write_bytes(b"\x00" * 100)

        mock_yolo_cls, mock_model = _mock_ultralytics(detections, names)

        # Temporarily patch ultralytics module
        mock_ultralytics = MagicMock()
        mock_ultralytics.YOLO = mock_yolo_cls
        with patch.dict(sys.modules, {"ultralytics": mock_ultralytics}):
            # Force re-import to pick up mock
            mod = importlib.import_module("openeye_ai.adapters.yolov8")
            importlib.reload(mod)
            adapter = mod.Adapter()
            adapter._do_load(tmp_path)
        return adapter, mock_model

    def test_do_load_missing_weights(self, tmp_path):
        mock_ultralytics = MagicMock()
        with patch.dict(sys.modules, {"ultralytics": mock_ultralytics}):
            mod = importlib.import_module("openeye_ai.adapters.yolov8")
            importlib.reload(mod)
            adapter = mod.Adapter()
            with pytest.raises(FileNotFoundError, match="Weights not found"):
                adapter._do_load(tmp_path)

    def test_do_predict_returns_detections(self, tmp_path):
        adapter, _ = self._load_adapter_with_mock(tmp_path)
        result = adapter._do_predict(_rgb_image())
        _assert_detection_result(result)
        assert len(result["objects"]) == 2
        assert result["objects"][0]["label"] == "person"
        assert result["objects"][1]["label"] == "car"
        assert result["depth_map"] is None
        for obj in result["objects"]:
            _assert_bbox_normalized(obj["bbox"])

    def test_do_predict_no_detections(self, tmp_path):
        adapter, _ = self._load_adapter_with_mock(tmp_path, detections=[], names={})
        result = adapter._do_predict(_rgb_image())
        assert result["objects"] == []

    def test_bbox_normalization(self, tmp_path):
        adapter, _ = self._load_adapter_with_mock(
            tmp_path,
            detections=[([0, 0, 200, 100], 0.99, 0)],
            names={0: "person"},
        )
        img = _rgb_image(200, 100)
        result = adapter._do_predict(img)
        bbox = result["objects"][0]["bbox"]
        assert bbox["x"] == 0.0
        assert bbox["y"] == 0.0
        assert bbox["w"] == 1.0
        assert bbox["h"] == 1.0

    def test_predict_before_load_raises(self):
        from openeye_ai.adapters.yolov8 import Adapter
        adapter = Adapter()
        # predict() checks _loaded before calling _do_load, so no import needed
        with pytest.raises(ModelNotLoadedError):
            adapter.predict(_rgb_image())

    def test_instantiation(self):
        from openeye_ai.adapters.yolov8 import Adapter
        adapter = Adapter()
        assert adapter._model is None
        assert adapter._loaded is False


# ── YOLO26 Adapter Tests ────────────────────────────────────────────


class TestYOLO26Adapter:
    def _load_adapter_with_mock(self, tmp_path, detections=None, names=None):
        weights = tmp_path / "yolo11n.pt"
        weights.write_bytes(b"\x00")
        mock_yolo_cls, mock_model = _mock_ultralytics(detections, names)

        mock_ultralytics = MagicMock()
        mock_ultralytics.YOLO = mock_yolo_cls
        with patch.dict(sys.modules, {"ultralytics": mock_ultralytics}):
            mod = importlib.import_module("openeye_ai.adapters.yolo26")
            importlib.reload(mod)
            adapter = mod.Adapter()
            adapter._do_load(tmp_path)
        return adapter, mock_model

    def test_do_load_missing_weights(self, tmp_path):
        mock_ultralytics = MagicMock()
        with patch.dict(sys.modules, {"ultralytics": mock_ultralytics}):
            mod = importlib.import_module("openeye_ai.adapters.yolo26")
            importlib.reload(mod)
            adapter = mod.Adapter()
            with pytest.raises(FileNotFoundError, match="Weights not found"):
                adapter._do_load(tmp_path)

    def test_do_predict_returns_objects(self, tmp_path):
        adapter, _ = self._load_adapter_with_mock(
            tmp_path, detections=[([5, 5, 45, 95], 0.88, 0)], names={0: "dog"}
        )
        result = adapter._do_predict(_rgb_image())
        _assert_detection_result(result)
        assert result["objects"][0]["label"] == "dog"
        assert result["depth_map"] is None


# ── Grounding DINO Adapter Tests ─────────────────────────────────────


class TestGroundingDINOAdapter:
    """Grounding DINO requires torch — tests are skipped if torch is not available."""

    @pytest.fixture(autouse=True)
    def _skip_without_torch(self):
        pytest.importorskip("torch")

    def _load_adapter_with_mock(self, tmp_path):
        import torch

        mock_transformers = MagicMock()
        proc_inst = MagicMock()
        proc_inst.return_value = {"input_ids": torch.tensor([[1, 2, 3]])}
        proc_inst.post_process_grounded_object_detection.return_value = [{
            "scores": torch.tensor([0.95, 0.80]),
            "text_labels": ["cat", "table"],
            "boxes": torch.tensor([[10, 20, 50, 80], [30, 10, 90, 60]]),
        }]
        mock_transformers.AutoProcessor.from_pretrained.return_value = proc_inst
        mock_transformers.AutoModelForZeroShotObjectDetection.from_pretrained.return_value = MagicMock()

        with patch.dict(sys.modules, {"transformers": mock_transformers}):
            mod = importlib.import_module("openeye_ai.adapters.grounding_dino")
            importlib.reload(mod)
            adapter = mod.Adapter()
            adapter._do_load(tmp_path)
        return adapter

    def test_do_predict_returns_detections(self, tmp_path):
        adapter = self._load_adapter_with_mock(tmp_path)
        result = adapter._do_predict(_rgb_image())
        _assert_detection_result(result)
        assert len(result["objects"]) == 2
        assert result["objects"][0]["label"] == "cat"

    def test_predict_before_load_raises(self):
        from openeye_ai.adapters.grounding_dino import Adapter
        adapter = Adapter()
        with pytest.raises(ModelNotLoadedError):
            adapter.predict(_rgb_image())

    def test_predict_with_prompt_before_load_raises(self):
        from openeye_ai.adapters.grounding_dino import Adapter
        adapter = Adapter()
        with pytest.raises(ModelNotLoadedError):
            adapter.predict_with_prompt(_rgb_image(), "cat")


# ── Depth Anything Adapter Tests ─────────────────────────────────────


class TestDepthAnythingAdapter:
    def _load_adapter_with_mock(self, tmp_path, depth_img=None):
        if depth_img is None:
            depth_img = Image.fromarray(np.random.randint(0, 255, (80, 100), dtype=np.uint8))

        mock_transformers = MagicMock()
        pipe_inst = MagicMock()
        pipe_inst.return_value = {"depth": depth_img}
        mock_transformers.pipeline.return_value = pipe_inst

        with patch.dict(sys.modules, {"transformers": mock_transformers}):
            mod = importlib.import_module("openeye_ai.adapters.depth_anything")
            importlib.reload(mod)
            adapter = mod.Adapter()
            adapter._do_load(tmp_path)
        return adapter

    def test_do_predict_returns_depth_map(self, tmp_path):
        adapter = self._load_adapter_with_mock(tmp_path)
        result = adapter._do_predict(_rgb_image())
        assert result["objects"] == []
        assert result["depth_map"] is not None
        assert isinstance(result["depth_map"], str)
        decoded = base64.b64decode(result["depth_map"])
        depth_decoded = Image.open(io.BytesIO(decoded))
        assert depth_decoded.mode == "L"
        assert result["inference_ms"] >= 0

    def test_do_predict_flat_depth(self, tmp_path):
        flat_depth = Image.fromarray(np.full((80, 100), 42, dtype=np.uint8))
        adapter = self._load_adapter_with_mock(tmp_path, depth_img=flat_depth)
        result = adapter._do_predict(_rgb_image())
        decoded = base64.b64decode(result["depth_map"])
        img = Image.open(io.BytesIO(decoded))
        arr = np.array(img)
        assert np.all(arr == 128)  # uniform gray for flat depth


# ── SAM2 Adapter Tests ──────────────────────────────────────────────


class TestSAM2Adapter:
    def _load_adapter_with_mock(self, tmp_path):
        checkpoint = tmp_path / "sam2_hiera_small.pt"
        checkpoint.write_bytes(b"\x00")

        mock_sam2_build = MagicMock()
        mock_sam2_build.build_sam2.return_value = MagicMock()
        mock_sam2_mask = MagicMock()
        mask_data = [
            {
                "segmentation": np.ones((80, 100), dtype=bool),
                "area": 8000,
                "bbox": [10, 20, 40, 30],
                "stability_score": 0.95,
            },
        ]
        gen_inst = MagicMock()
        gen_inst.generate.return_value = mask_data
        mock_sam2_mask.SAM2AutomaticMaskGenerator.return_value = gen_inst

        with patch.dict(sys.modules, {
            "sam2": MagicMock(),
            "sam2.build_sam": mock_sam2_build,
            "sam2.automatic_mask_generator": mock_sam2_mask,
        }):
            mod = importlib.import_module("openeye_ai.adapters.sam2")
            importlib.reload(mod)
            adapter = mod.Adapter()
            adapter._do_load(tmp_path)
        return adapter

    def test_do_load_missing_weights(self, tmp_path):
        mock_sam2_build = MagicMock()
        mock_sam2_mask = MagicMock()
        with patch.dict(sys.modules, {
            "sam2": MagicMock(),
            "sam2.build_sam": mock_sam2_build,
            "sam2.automatic_mask_generator": mock_sam2_mask,
        }):
            mod = importlib.import_module("openeye_ai.adapters.sam2")
            importlib.reload(mod)
            adapter = mod.Adapter()
            with pytest.raises(FileNotFoundError, match="No SAM2 weights"):
                adapter._do_load(tmp_path)

    def test_do_predict_returns_masks(self, tmp_path):
        adapter = self._load_adapter_with_mock(tmp_path)
        result = adapter._do_predict(_rgb_image())
        assert result["objects"] == []
        assert result["depth_map"] is None
        assert "segmentation_masks" in result
        assert len(result["segmentation_masks"]) == 1
        mask = result["segmentation_masks"][0]
        assert "mask" in mask
        assert "area" in mask
        assert "stability_score" in mask
        _assert_bbox_normalized(mask["bbox"])


# ── SmolVLA Adapter Tests ────────────────────────────────────────────


class TestSmolVLAAdapter:
    """SmolVLA requires torch — tests are skipped if torch is not available."""

    @pytest.fixture(autouse=True)
    def _skip_without_torch(self):
        pytest.importorskip("torch")

    def _load_adapter_with_mock(self, tmp_path):
        import torch

        action_tensor = torch.tensor([0.1, -0.2, 0.5, 0.0, 0.3, 0.8, 1.0])
        policy_inst = MagicMock()
        policy_inst.eval.return_value = policy_inst
        policy_inst.select_action.return_value = action_tensor

        mock_lerobot = MagicMock()
        mock_lerobot.common.policies.smolvla.modeling_smolvla.SmolVLAPolicy.from_pretrained.return_value = policy_inst

        with patch.dict(sys.modules, {
            "lerobot": mock_lerobot,
            "lerobot.common": mock_lerobot.common,
            "lerobot.common.policies": mock_lerobot.common.policies,
            "lerobot.common.policies.smolvla": mock_lerobot.common.policies.smolvla,
            "lerobot.common.policies.smolvla.modeling_smolvla": mock_lerobot.common.policies.smolvla.modeling_smolvla,
        }):
            mod = importlib.import_module("openeye_ai.adapters.smolvla")
            importlib.reload(mod)
            adapter = mod.Adapter()
            with patch("torch.cuda.is_available", return_value=False):
                adapter._do_load(tmp_path)
        return adapter

    def test_do_predict_returns_vla_action(self, tmp_path):
        adapter = self._load_adapter_with_mock(tmp_path)
        with patch("torch.cuda.is_available", return_value=False):
            result = adapter._do_predict(_rgb_image())
        assert result["objects"] == []
        assert result["depth_map"] is None
        assert "vla_action" in result
        assert isinstance(result["vla_action"], list)
        assert len(result["vla_action"]) == 7


# ── RF-DETR Adapter Tests ───────────────────────────────────────────


class TestRFDETRAdapter:
    def _load_adapter_with_mock(self, tmp_path, detections=None):
        mock_rfdetr = MagicMock()
        if detections is None:
            fake_dets = MagicMock()
            fake_dets.xyxy = np.array([[10, 20, 50, 80], [30, 10, 70, 60]])
            fake_dets.confidence = np.array([0.92, 0.75])
            fake_dets.class_id = np.array([0, 1])
        else:
            fake_dets = detections
        mock_model = MagicMock()
        mock_model.predict.return_value = fake_dets
        mock_rfdetr.RFDETRBase.return_value = mock_model

        with patch.dict(sys.modules, {"rfdetr": mock_rfdetr}):
            mod = importlib.import_module("openeye_ai.adapters.rfdetr")
            importlib.reload(mod)
            adapter = mod.Adapter()
            adapter._do_load(tmp_path)
        return adapter

    def test_do_predict_with_supervision_detections(self, tmp_path):
        adapter = self._load_adapter_with_mock(tmp_path)
        result = adapter._do_predict(_rgb_image())
        _assert_detection_result(result)
        assert len(result["objects"]) == 2
        assert result["depth_map"] is None
        for obj in result["objects"]:
            _assert_bbox_normalized(obj["bbox"])

    def test_do_predict_no_xyxy_attribute(self, tmp_path):
        plain_result = MagicMock(spec=[])
        adapter = self._load_adapter_with_mock(tmp_path, detections=plain_result)
        result = adapter._do_predict(_rgb_image())
        assert result["objects"] == []


# ── ONNX Runtime Base Adapter Tests ─────────────────────────────────


class TestONNXAdapter:
    def _make_adapter(self):
        from openeye_ai.adapters.onnx_runtime import ONNXAdapter
        return ONNXAdapter()

    def _load_with_mock(self, tmp_path):
        onnx_file = tmp_path / "model.onnx"
        onnx_file.write_bytes(b"\x00")

        mock_ort = MagicMock()
        mock_input = MagicMock()
        mock_input.name = "images"
        mock_session = MagicMock()
        mock_session.get_inputs.return_value = [mock_input]
        mock_session.run.return_value = [np.zeros((1, 84, 8400))]
        mock_ort.InferenceSession.return_value = mock_session

        with patch.dict(sys.modules, {"onnxruntime": mock_ort}):
            mod = importlib.import_module("openeye_ai.adapters.onnx_runtime")
            importlib.reload(mod)
            adapter = mod.ONNXAdapter()
            adapter._do_load(tmp_path)
        return adapter, mock_session

    def test_do_load_no_onnx_file(self, tmp_path):
        mock_ort = MagicMock()
        with patch.dict(sys.modules, {"onnxruntime": mock_ort}):
            mod = importlib.import_module("openeye_ai.adapters.onnx_runtime")
            importlib.reload(mod)
            adapter = mod.ONNXAdapter()
            with pytest.raises(FileNotFoundError, match="No .onnx file"):
                adapter._do_load(tmp_path)

    def test_preprocess_shape(self):
        adapter = self._make_adapter()
        tensor = adapter.preprocess(_rgb_image(200, 150))
        assert tensor.shape == (1, 3, 640, 640)
        assert tensor.dtype == np.float32
        assert tensor.max() <= 1.0
        assert tensor.min() >= 0.0

    def test_postprocess_default(self):
        adapter = self._make_adapter()
        result = adapter.postprocess([], _rgb_image())
        assert result == {"objects": [], "depth_map": None, "inference_ms": 0.0}

    def test_do_predict_calls_session_run(self, tmp_path):
        adapter, mock_session = self._load_with_mock(tmp_path)
        result = adapter._do_predict(_rgb_image())
        mock_session.run.assert_called_once()
        assert "inference_ms" in result

    def test_get_providers_always_includes_cpu(self):
        adapter = self._make_adapter()
        providers = adapter._get_providers()
        assert "CPUExecutionProvider" in providers

    def test_get_registry_info_returns_none(self):
        adapter = self._make_adapter()
        assert adapter._get_registry_info() is None


# ── YOLOv8 ONNX Adapter Tests ───────────────────────────────────────


class TestYOLOv8ONNXAdapter:
    def _make_adapter(self):
        from openeye_ai.adapters.yolov8_onnx import Adapter
        return Adapter()

    def test_preprocess_shape(self):
        adapter = self._make_adapter()
        tensor = adapter.preprocess(_rgb_image())
        assert tensor.shape == (1, 3, 640, 640)

    def test_postprocess_high_confidence(self):
        adapter = self._make_adapter()
        output = np.zeros((1, 84, 8400), dtype=np.float32)
        output[0, 0, 0] = 320  # cx
        output[0, 1, 0] = 320  # cy
        output[0, 2, 0] = 100  # w
        output[0, 3, 0] = 100  # h
        output[0, 4, 0] = 0.9  # person class score

        result = adapter.postprocess([output], _rgb_image())
        assert len(result["objects"]) >= 1
        assert result["objects"][0]["label"] == "person"
        assert result["objects"][0]["confidence"] == 0.9
        _assert_bbox_normalized(result["objects"][0]["bbox"])

    def test_postprocess_below_threshold(self):
        adapter = self._make_adapter()
        output = np.zeros((1, 84, 8400), dtype=np.float32)
        output[0, 4:, :] = 0.1
        result = adapter.postprocess([output], _rgb_image())
        assert result["objects"] == []
        assert result["depth_map"] is None

    def test_postprocess_limits_to_100(self):
        adapter = self._make_adapter()
        output = np.zeros((1, 84, 8400), dtype=np.float32)
        output[0, 0, :200] = 320
        output[0, 1, :200] = 320
        output[0, 2, :200] = 50
        output[0, 3, :200] = 50
        output[0, 4, :200] = 0.9
        result = adapter.postprocess([output], _rgb_image())
        assert len(result["objects"]) <= 100

    def test_coco_classes_length(self):
        from openeye_ai.adapters.yolov8_onnx import COCO_CLASSES
        assert len(COCO_CLASSES) == 80


# ── TensorRT Runtime Adapter Tests ───────────────────────────────────


class TestTensorRTAdapter:
    def _make_adapter(self):
        from openeye_ai.adapters.tensorrt_runtime import Adapter
        return Adapter()

    def test_get_providers_includes_tensorrt(self):
        adapter = self._make_adapter()
        providers = adapter._get_providers()
        assert providers[0] == "TensorrtExecutionProvider"
        assert "CUDAExecutionProvider" in providers
        assert "CPUExecutionProvider" in providers

    def test_is_subclass_of_onnx_adapter(self):
        from openeye_ai.adapters.onnx_runtime import ONNXAdapter
        from openeye_ai.adapters.tensorrt_runtime import Adapter, TensorRTAdapter
        assert issubclass(TensorRTAdapter, ONNXAdapter)
        assert issubclass(Adapter, TensorRTAdapter)


# ── Cross-adapter integration tests ─────────────────────────────────


class TestAdapterCommonBehavior:
    ADAPTER_CLASSES = [
        "openeye_ai.adapters.yolov8.Adapter",
        "openeye_ai.adapters.yolo26.Adapter",
        "openeye_ai.adapters.yolov8_onnx.Adapter",
        "openeye_ai.adapters.grounding_dino.Adapter",
        "openeye_ai.adapters.depth_anything.Adapter",
        "openeye_ai.adapters.sam2.Adapter",
        "openeye_ai.adapters.smolvla.Adapter",
        "openeye_ai.adapters.rfdetr.Adapter",
        "openeye_ai.adapters.tensorrt_runtime.Adapter",
    ]

    @pytest.mark.parametrize("class_path", ADAPTER_CLASSES)
    def test_all_adapters_are_model_adapter_subclasses(self, class_path):
        module_path, class_name = class_path.rsplit(".", 1)
        mod = importlib.import_module(module_path)
        cls = getattr(mod, class_name)
        assert issubclass(cls, ModelAdapter)

    @pytest.mark.parametrize("class_path", ADAPTER_CLASSES)
    def test_all_adapters_have_required_methods(self, class_path):
        module_path, class_name = class_path.rsplit(".", 1)
        mod = importlib.import_module(module_path)
        cls = getattr(mod, class_name)
        for method in ("pull", "_do_load", "_do_predict"):
            assert hasattr(cls, method), f"{class_path} missing {method}"

    @pytest.mark.parametrize("class_path", ADAPTER_CLASSES)
    def test_predict_before_load_raises(self, class_path):
        module_path, class_name = class_path.rsplit(".", 1)
        mod = importlib.import_module(module_path)
        cls = getattr(mod, class_name)
        adapter = cls()
        with pytest.raises(ModelNotLoadedError):
            adapter.predict(_rgb_image())
