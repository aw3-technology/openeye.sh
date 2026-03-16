# Building a Custom Adapter

This tutorial walks through creating a custom model adapter for OpenEye.

## Step 1: Create the Adapter

Create a Python file implementing the `ModelAdapter` ABC:

```python
# my_adapter.py
from pathlib import Path
from typing import Any
import time

from PIL import Image
from openeye_ai.adapters.base import ModelAdapter


class Adapter(ModelAdapter):
    """Custom adapter for MyModel."""

    def __init__(self):
        self.model = None

    def _do_load(self, model_dir: Path) -> None:
        # Load your model weights
        weights_path = model_dir / "weights.bin"
        # self.model = MyModel.load(weights_path)
        pass

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        start = time.perf_counter()

        # Run your inference
        # results = self.model.predict(image)

        elapsed = (time.perf_counter() - start) * 1000

        return {
            "objects": [
                {
                    "label": "example",
                    "confidence": 0.9,
                    "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4},
                }
            ],
            "inference_ms": elapsed,
        }

    def pull(self, model_dir: Path) -> None:
        model_dir.mkdir(parents=True, exist_ok=True)
        # Download your weights here
        # e.g., download_from_hf("my-org/my-model", model_dir)
```

## Step 2: Register via the CLI

Use `register-adapter` to validate and register your adapter in one step:

```bash
openeye register-adapter my-model ./my_adapter.py \
    --name "My Custom Model" \
    --task detection \
    --description "My custom detection model"
```

This validates the adapter file (ensuring it exports an `Adapter` class that subclasses `ModelAdapter`) and adds it to the model registry.

Alternatively, use `add-model` for more control:

```bash
openeye add-model my-model \
    --adapter ./my_adapter.py \
    --task detection \
    --description "My custom detection model"
```

When `--name` is omitted it defaults to the registry key (`my-model` above).

### Manual registration (advanced)

You can also add your model directly to `cli/openeye_ai/models.yaml`:

```yaml
models:
  my-model:
    name: My Custom Model
    task: detection
    description: "My custom detection model"
    adapter: ./my_adapter.py
    size_mb: 50
    hardware:
      cpu: true
      cuda: true
      mps: false
```

The `adapter` field points to your Python file. OpenEye will load it as a custom adapter.

## Step 3: Use It

```bash
openeye pull my-model
openeye run my-model image.jpg
openeye bench my-model
openeye serve my-model
```

## Return Value Contract

The `_do_predict()` method must return a dict compatible with `PredictionResult`:

- **Detection models**: Return `objects` (list of dicts with `label`, `confidence`, `bbox`) and `inference_ms`
- **Depth models**: Return `depth_map` (base64 PNG string) and `inference_ms`

## Testing

Use the `FakeAdapter` pattern from `cli/tests/conftest.py` to test without real ML dependencies.
