"""Tests for custom adapter loading (openeye_ai.utils.custom_adapter)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from PIL import Image

from openeye_ai.utils.custom_adapter import CustomAdapterError, load_custom_adapter

# ── Valid adapter source ─────────────────────────────────────────────

_VALID_ADAPTER = """\
from pathlib import Path
from typing import Any
from PIL import Image
from openeye_ai.adapters.base import ModelAdapter


class Adapter(ModelAdapter):
    def _do_load(self, model_dir: Path) -> None:
        pass

    def _do_predict(self, image: Image.Image) -> dict[str, Any]:
        return {"objects": [], "inference_ms": 0.1}

    def pull(self, model_dir: Path) -> None:
        model_dir.mkdir(parents=True, exist_ok=True)
"""

_NO_ADAPTER_CLASS = """\
class NotAnAdapter:
    pass
"""

_BAD_SUBCLASS = """\
class Adapter:
    pass
"""


# ── Tests ────────────────────────────────────────────────────────────


def test_load_valid_adapter(tmp_path: Path):
    adapter_file = tmp_path / "my_adapter.py"
    adapter_file.write_text(_VALID_ADAPTER)

    adapter = load_custom_adapter(adapter_file)

    from openeye_ai.adapters.base import ModelAdapter

    assert isinstance(adapter, ModelAdapter)


def test_missing_file_raises(tmp_path: Path):
    missing = tmp_path / "does_not_exist.py"
    with pytest.raises(CustomAdapterError, match="not found"):
        load_custom_adapter(missing)


def test_non_py_file_raises(tmp_path: Path):
    bad = tmp_path / "adapter.txt"
    bad.write_text("x = 1")
    with pytest.raises(CustomAdapterError, match=".py"):
        load_custom_adapter(bad)


def test_no_adapter_class_raises(tmp_path: Path):
    f = tmp_path / "no_cls.py"
    f.write_text(_NO_ADAPTER_CLASS)
    with pytest.raises(CustomAdapterError, match="No 'Adapter' class"):
        load_custom_adapter(f)


def test_adapter_not_subclass_raises(tmp_path: Path):
    f = tmp_path / "bad_sub.py"
    f.write_text(_BAD_SUBCLASS)
    with pytest.raises(CustomAdapterError, match="subclasses ModelAdapter"):
        load_custom_adapter(f)


def test_adapter_lifecycle(tmp_path: Path):
    """Valid adapter can load and predict."""
    adapter_file = tmp_path / "lifecycle_adapter.py"
    adapter_file.write_text(_VALID_ADAPTER)

    adapter = load_custom_adapter(adapter_file)

    model_dir = tmp_path / "model"
    adapter.load(model_dir)

    img = Image.new("RGB", (10, 10), color="blue")
    result = adapter.predict(img)

    assert "objects" in result
    assert "inference_ms" in result
