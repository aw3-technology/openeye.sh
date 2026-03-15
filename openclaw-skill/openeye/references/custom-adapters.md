# Custom Adapters Reference

## Adapter Interface

All models implement the `ModelAdapter` ABC:

```python
from openeye_ai.adapters.base import ModelAdapter
from PIL import Image

class Adapter(ModelAdapter):
    def _do_load(self, model_dir: str) -> None:
        """Load model weights from model_dir into memory."""
        ...

    def _do_predict(self, image: Image.Image) -> dict:
        """Run inference on a PIL Image. Return structured dict."""
        ...

    def pull(self, model_dir: str) -> None:
        """Download model weights to model_dir."""
        ...
```

## Return Format

Detection models return:
```json
{
  "objects": [
    {"label": "person", "confidence": 0.95, "bbox": [x1, y1, x2, y2]},
    {"label": "chair", "confidence": 0.87, "bbox": [x1, y1, x2, y2]}
  ],
  "inference_ms": 12.3
}
```

Depth models return:
```json
{
  "depth_map": [[...], ...],
  "inference_ms": 18.7
}
```

## Registration

```bash
# Register adapter from Python file
openeye register-adapter my-model ./my_adapter.py \
  --name "My Custom Model" \
  --task detection

# Register model entry pointing to HuggingFace
openeye add-model my-model \
  --name "My Custom Model" \
  --task detection \
  --adapter my-model \
  --hf-repo username/my-model-weights
```

## Built-in Adapters

| Adapter | Task | Notes |
|---------|------|-------|
| `yolov8` | detection | Ultralytics YOLOv8, default backend |
| `yolov8:onnx` | detection | ONNX Runtime optimized |
| `yolov8:tensorrt` | detection | TensorRT for NVIDIA GPUs |
| `depth_anything` | depth | Depth Anything V2 monocular depth |
| `grounding_dino` | detection | Open-vocabulary, requires `--prompt` |
| `onnx_generic` | varies | Generic ONNX model wrapper |

## Adapter Lifecycle

1. `pull()` downloads weights (typically from HuggingFace Hub)
2. `load()` loads weights into memory (lazy — called on first predict)
3. `predict()` runs inference, returns structured dict
4. Models cached in `~/.openeye/models/<model-key>/`
