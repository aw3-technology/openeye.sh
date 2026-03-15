"""Abstract base class for model adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from PIL import Image


class ModelNotLoadedError(RuntimeError):
    """Raised when predict() is called before load()."""


class ModelAdapter(ABC):
    """Every model adapter must implement load() and predict()."""

    _loaded: bool = False

    def load(self, model_dir: Path) -> None:
        """Load model weights from disk."""
        self._do_load(model_dir)
        self._loaded = True

    @abstractmethod
    def _do_load(self, model_dir: Path) -> None:
        """Subclass hook: actually load weights."""

    def predict(self, image: Image.Image) -> dict[str, Any]:
        """Run inference on a PIL Image and return a result dict."""
        if not self._loaded:
            raise ModelNotLoadedError("Model not loaded. Call load() before predict().")
        return self._do_predict(image)

    @abstractmethod
    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        """Subclass hook: run inference.

        Must include keys compatible with PredictionResult schema:
        - objects: list[dict] (for detection models)
        - depth_map: str | None (for depth models)
        - inference_ms: float
        """

    @abstractmethod
    def pull(self, model_dir: Path) -> None:
        """Download model weights to model_dir."""
