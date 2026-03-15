"""YOLOv8 ONNX adapter — object detection via ONNX Runtime."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image

from openeye_ai.adapters.onnx_runtime import ONNXAdapter

# COCO class names for YOLOv8
COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
    "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
    "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
    "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
    "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
    "hair drier", "toothbrush",
]


class Adapter(ONNXAdapter):
    """YOLOv8 detection using ONNX Runtime."""

    def __init__(self) -> None:
        super().__init__()
        self._conf_threshold = 0.25
        self._iou_threshold = 0.45

    def pull(self, model_dir: Path) -> None:
        from openeye_ai.utils.download import download_from_hf

        model_dir.mkdir(parents=True, exist_ok=True)
        download_from_hf("ultralytics/yolov8", model_dir, "yolov8n_int8.onnx")

    def preprocess(self, image: Image.Image):
        import numpy as np

        img = image.resize((640, 640))
        arr = np.array(img).astype(np.float32) / 255.0
        arr = arr.transpose(2, 0, 1)  # HWC -> CHW
        return np.expand_dims(arr, axis=0)

    def postprocess(self, outputs: list, image: Image.Image) -> dict[str, Any]:
        """Parse YOLOv8 ONNX output format: (1, 84, 8400) -> list of detections."""
        import numpy as np

        predictions = outputs[0]  # shape: (1, 84, 8400) or (1, 8400, 84)

        # Normalize to (8400, 84)
        if predictions.ndim == 3:
            predictions = predictions[0]
        if predictions.shape[0] == 84:
            predictions = predictions.T  # (84, 8400) -> (8400, 84)

        w_img, h_img = image.size
        objects = []

        for det in predictions:
            cx, cy, w, h = det[:4]
            class_scores = det[4:]
            class_id = int(np.argmax(class_scores))
            confidence = float(class_scores[class_id])

            if confidence < self._conf_threshold:
                continue

            x1 = (cx - w / 2) / 640
            y1 = (cy - h / 2) / 640
            bw = w / 640
            bh = h / 640

            label = COCO_CLASSES[class_id] if class_id < len(COCO_CLASSES) else f"class_{class_id}"
            objects.append({
                "label": label,
                "confidence": round(confidence, 4),
                "bbox": {
                    "x": round(max(0, x1), 4),
                    "y": round(max(0, y1), 4),
                    "w": round(min(1, bw), 4),
                    "h": round(min(1, bh), 4),
                },
            })

        # Simple NMS by confidence (keep top detections per class)
        objects.sort(key=lambda o: o["confidence"], reverse=True)
        return {"objects": objects[:100], "depth_map": None}
