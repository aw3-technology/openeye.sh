# Model Adapters

Adapters are the bridge between OpenEye and ML model backends. Each adapter implements loading and inference for a specific model type.

## ModelAdapter ABC

All adapters extend `openeye_ai.adapters.base.ModelAdapter`:

```python
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any
from PIL import Image

class ModelAdapter(ABC):
    _loaded: bool = False

    def load(self, model_dir: Path) -> None:
        self._do_load(model_dir)
        self._loaded = True

    @abstractmethod
    def _do_load(self, model_dir: Path) -> None:
        """Load model weights from disk."""

    def predict(self, image: Image.Image) -> dict[str, Any]:
        if not self._loaded:
            raise ModelNotLoadedError(...)
        return self._do_predict(image)

    @abstractmethod
    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        """Run inference. Return dict with 'objects' and/or 'depth_map'."""

    @abstractmethod
    def pull(self, model_dir: Path) -> None:
        """Download model weights."""
```

## Built-in Adapters

| Adapter | Module | Models |
|---------|--------|--------|
| `yolov8` | `openeye_ai.adapters.yolov8` | YOLOv8 (ultralytics) |
| `depth_anything` | `openeye_ai.adapters.depth_anything` | Depth Anything V2 |
| `grounding_dino` | `openeye_ai.adapters.grounding_dino` | Grounding DINO |
| `yolov8:onnx` | `openeye_ai.adapters.yolov8_onnx` | YOLOv8 ONNX |
| `onnx_generic` | `openeye_ai.adapters.onnx_runtime` | Generic ONNX |
| `yolov8:tensorrt` | `openeye_ai.adapters.tensorrt_runtime` | YOLOv8 TensorRT |

## Lifecycle

1. **`pull(model_dir)`** — Download weights to the model directory
2. **`load(model_dir)`** — Load weights into memory
3. **`predict(image)`** — Run inference on a PIL Image
4. Return dict must include `inference_ms` and either `objects` or `depth_map`

## Custom Adapters

See the [Custom Adapter Tutorial](../tutorials/custom-adapter.md) for building your own.
