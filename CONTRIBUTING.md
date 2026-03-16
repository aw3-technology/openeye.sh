# Contributing to OpenEye

Thanks for your interest in contributing to OpenEye! This guide will help you get set up and productive quickly.

## Prerequisites

- **Python 3.10+** (CLI package) / **Python 3.11+** (backend)
- **Node.js 20+** and npm (frontend)
- **Git**

## Repository Structure

```
openeye.sh/
├── cli/              # openeye-sh CLI & inference server (Python)
├── backend/          # Perception engine runtime (Python)
├── src/              # React frontend (TypeScript)
├── docs/             # MkDocs documentation site
└── .github/          # CI workflows
```

## Getting Started

### Frontend

```bash
npm install
npm run dev          # Start dev server
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npm test             # Run vitest
```

### CLI

```bash
cd cli
pip install -e ".[all]" --group dev
ruff check           # Lint
ruff format --check  # Format check
pytest -v            # Run tests (excludes integration)
```

### Backend

```bash
cd backend
pip install -e . --group dev
ruff check
ruff format --check
pytest -v
```

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests and linting pass locally
4. Submit a pull request

## Coding Standards

### Python (CLI & Backend)

- Formatter/linter: **ruff** (configured in each `pyproject.toml`)
- Line length: 88 characters
- Use type hints on all public functions
- Follow existing patterns for adapters, providers, and plugins

### TypeScript (Frontend)

- Linter: **ESLint** (configured in project root)
- Component style: functional components with hooks
- Use `@/` path alias for imports from `src/`
- UI components: shadcn/ui in `src/components/ui/`

## Testing Guidelines

### CLI Tests

- **Mock all ML imports** (ultralytics, transformers, torch) — tests must run without GPU or model downloads
- Use the `FakeAdapter` from `tests/conftest.py` for server and integration tests
- Mark tests requiring real models with `@pytest.mark.integration`
- Mark slow tests with `@pytest.mark.slow`

### Backend Tests

- Singleton providers are **auto-reset** between tests via the autouse fixture in `conftest.py`
- Use `pytest-asyncio` with `asyncio_mode = "strict"` — mark async tests explicitly
- Mock plugin loaders (`load_input`, `load_llm`, etc.) when testing config

### Frontend Tests

- Use `@testing-library/react` with `screen` queries
- Wrap components needing routing in `<MemoryRouter>`
- Mock heavy child components with `vi.mock()` to keep tests fast
- The `IntersectionObserver` mock is provided in `src/test/setup.ts`

## Pull Request Process

1. Ensure CI passes (frontend lint + test, CLI lint + test, backend lint + test)
2. Write clear commit messages describing the "why"
3. Keep PRs focused — one feature or fix per PR
4. Add tests for new functionality
5. Update documentation if adding new CLI commands or API endpoints

## Writing a Custom Adapter

OpenEye uses an adapter pattern to support multiple vision AI backends. Each adapter wraps a model behind a common interface so the CLI, server, and batch pipeline can use it interchangeably.

### The `ModelAdapter` ABC

All adapters inherit from `ModelAdapter` (`cli/openeye_ai/adapters/base.py`) and implement three abstract methods:

```python
from pathlib import Path
from PIL import Image
from typing import Any
from openeye_ai.adapters.base import ModelAdapter


class Adapter(ModelAdapter):
    """My custom detector."""

    def __init__(self) -> None:
        super().__init__()
        self._model = None

    def pull(self, model_dir: Path) -> None:
        """Download model weights to model_dir."""
        model_dir.mkdir(parents=True, exist_ok=True)
        # Download weights here (HuggingFace, URL, etc.)

    def _do_load(self, model_dir: Path) -> None:
        """Load weights from disk into memory."""
        # Called by the public load() method, which sets _loaded = True on success
        self._model = ...

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        """Run inference on a PIL RGB image and return results."""
        ...
```

The public `load()` and `predict()` methods handle lifecycle guards: `load()` calls `_do_load()` then sets `_loaded = True`, and `predict()` raises `ModelNotLoadedError` if the model hasn't been loaded.

### Return Schema

`_do_predict()` must return a dict with these keys:

| Key | Type | Description |
|-----|------|-------------|
| `objects` | `list[dict]` | Detected objects (empty `[]` for non-detection models) |
| `depth_map` | `str \| None` | Base64-encoded PNG for depth models, `None` otherwise |
| `inference_ms` | `float` | Inference time in milliseconds |

Each object in `objects` must contain:

```python
{
    "label": "person",          # class name
    "confidence": 0.9512,       # float 0–1, rounded to 4 decimals
    "bbox": {
        "x": 0.1,              # left edge, normalized 0–1 by image width
        "y": 0.2,              # top edge, normalized 0–1 by image height
        "w": 0.3,              # width, normalized
        "h": 0.4,              # height, normalized
    },
}
```

Adapters may return additional keys for specialized tasks (e.g., `segmentation_masks` for SAM2), but the three core keys are required.

**Timing pattern:**

```python
import time

start = time.perf_counter()
result = self._model(image)
elapsed = (time.perf_counter() - start) * 1000

return {
    "objects": objects,
    "depth_map": None,
    "inference_ms": round(elapsed, 2),
}
```

### Registering Your Adapter

Two CLI commands register custom adapters:

**`openeye add-model`** — register a model with a built-in or custom adapter:

```bash
openeye add-model my-detector \
  --name "My Detector" \
  --task detection \
  --adapter ./my_adapter.py \
  --hf-repo my-org/my-model \
  --size-mb 25 \
  --description "Custom object detector"
```

**`openeye register-adapter`** — shorthand that validates the adapter file and registers it:

```bash
openeye register-adapter my-detector ./my_adapter.py \
  --name "My Detector" \
  --task detection \
  --description "Custom object detector"
```

Both commands add an entry to `models.yaml`. The adapter file must define a class named `Adapter` that subclasses `ModelAdapter`. The registry resolves custom adapters by detecting a `/` or `.py` suffix in the adapter path, then dynamically imports the module.

### Testing with `FakeAdapter`

The test suite provides a `FakeAdapter` in `cli/tests/conftest.py` that returns canned data without loading any model:

```python
class FakeAdapter(ModelAdapter):
    def _do_load(self, model_dir: Path) -> None:
        pass  # no-op

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
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
```

Use the `fake_adapter` pytest fixture for server and integration tests. Write unit tests for your adapter following the patterns in `cli/tests/test_adapter_base.py`:

- Verify `ModelNotLoadedError` is raised when `predict()` is called before `load()`
- Verify a failed `_do_load()` does not set `_loaded = True`
- Verify the return dict includes all required keys with correct types
- Mark tests that download real models with `@pytest.mark.integration`

### Lazy Import Pattern

**Never import heavy ML dependencies at module level.** Import them inside the methods that use them so the adapter module can be imported without installing PyTorch, transformers, etc.:

```python
class Adapter(ModelAdapter):
    def pull(self, model_dir: Path) -> None:
        from huggingface_hub import snapshot_download  # lazy
        snapshot_download(repo_id="my-org/my-model", local_dir=str(model_dir))

    def _do_load(self, model_dir: Path) -> None:
        from transformers import AutoModel  # lazy
        self._model = AutoModel.from_pretrained(str(model_dir))

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        import torch  # lazy
        with torch.no_grad():
            outputs = self._model(image)
        ...
```

This pattern ensures that `pytest`, `ruff`, and the CLI can import and inspect adapter modules without GPU hardware or multi-GB dependencies installed. Only the methods that actually use the dependency import it. See existing adapters in `cli/openeye_ai/adapters/` for complete examples.

## Architecture

See `docs/` for detailed architecture documentation:

- **CLI**: Adapter pattern for model backends, FastAPI server, typer CLI
- **Backend**: Mode-based cortex runtime with plugin-based inputs, actions, and LLM providers
- **Frontend**: React + Vite + TailwindCSS with shadcn/ui components
