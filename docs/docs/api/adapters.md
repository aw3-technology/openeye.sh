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

| Adapter | Module | Task |
|---------|--------|------|
| `yolov8` | `openeye_ai.adapters.yolov8` | Object detection (Ultralytics YOLOv8) |
| `yolo26` | `openeye_ai.adapters.yolo26` | Object detection (YOLOv26) |
| `depth_anything` | `openeye_ai.adapters.depth_anything` | Monocular depth estimation (Depth Anything V2) |
| `grounding_dino` | `openeye_ai.adapters.grounding_dino` | Open-vocabulary detection (Grounding DINO) |
| `rfdetr` | `openeye_ai.adapters.rfdetr` | Object detection (RF-DETR) |
| `sam2` | `openeye_ai.adapters.sam2` | Segmentation (Segment Anything 2) |
| `smolvla` | `openeye_ai.adapters.smolvla` | Vision-language-action (SmoLVLA) |
| `yolov8:onnx` | `openeye_ai.adapters.yolov8_onnx` | YOLOv8 via ONNX Runtime |
| `onnx_generic` | `openeye_ai.adapters.onnx_runtime` | Generic ONNX Runtime |
| `yolov8:tensorrt` | `openeye_ai.adapters.tensorrt_runtime` | YOLOv8 via TensorRT |
| `tensorrt_generic` | `openeye_ai.adapters.tensorrt_runtime` | Generic TensorRT Runtime |

## Lifecycle

1. **`pull(model_dir)`** — Download weights to the model directory
2. **`load(model_dir)`** — Load weights into memory
3. **`predict(image)`** — Run inference on a PIL Image
4. Return dict must include `inference_ms` and either `objects` or `depth_map`

## Custom Adapters

OpenEye supports loading custom adapters from standalone Python files. A custom adapter is a `.py` file that exports an `Adapter` class subclassing `ModelAdapter`.

### `register-adapter`

Validate and register a custom adapter in one command:

```bash
openeye register-adapter my-model ./my_adapter.py \
    --name "My Model" --task detection
```

This loads the file, verifies the `Adapter` class, and adds the model to the registry.

### `add-model`

For models that use a built-in or custom adapter:

```bash
openeye add-model my-model \
    --adapter ./my_adapter.py --task detection
```

`--name` defaults to the registry key when omitted. Fields like `--hf-repo`, `--filename`, and `--size-mb` are optional.

### Complete workflow

```bash
# 1. Write your adapter (see tutorial)
# 2. Register it
openeye register-adapter my-model ./my_adapter.py \
    --name "My Model" --task detection

# 3. Pull, run, benchmark, or serve
openeye pull my-model
openeye run my-model image.jpg
openeye bench my-model
openeye serve my-model
```

See the [Custom Adapter Tutorial](../tutorials/custom-adapter.md) for a full walkthrough.
