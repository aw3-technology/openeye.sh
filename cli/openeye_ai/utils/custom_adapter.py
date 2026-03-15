"""Dynamic loading of custom model adapters from file paths."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from openeye_ai.adapters.base import ModelAdapter


class CustomAdapterError(RuntimeError):
    """Raised when a custom adapter cannot be loaded."""


def load_custom_adapter(filepath: str | Path) -> ModelAdapter:
    """Load a custom adapter from a Python file.

    The file must define a class named 'Adapter' that subclasses ModelAdapter.
    """
    filepath = Path(filepath)
    if not filepath.exists():
        raise CustomAdapterError(f"Adapter file not found: {filepath}")
    if not filepath.suffix == ".py":
        raise CustomAdapterError(f"Adapter file must be a .py file: {filepath}")

    spec = importlib.util.spec_from_file_location("custom_adapter", str(filepath))
    if spec is None or spec.loader is None:
        raise CustomAdapterError(f"Cannot create module spec from: {filepath}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    adapter_cls = getattr(module, "Adapter", None)
    if adapter_cls is None:
        raise CustomAdapterError(f"No 'Adapter' class found in {filepath}")

    if not isinstance(adapter_cls, type) or not issubclass(adapter_cls, ModelAdapter):
        raise CustomAdapterError(
            f"'Adapter' in {filepath} must be a class that subclasses ModelAdapter"
        )

    return adapter_cls()
