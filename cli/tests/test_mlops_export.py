"""Tests for openeye_ai.mlops.export — format detection."""

from __future__ import annotations

from pathlib import Path

import pytest


class TestExport:
    def test_detect_source_format(self):
        from openeye_ai.mlops.export import _detect_source_format
        from openeye_ai.mlops.schemas import ModelFormat

        assert _detect_source_format(Path("model.onnx")) == ModelFormat.ONNX
        assert _detect_source_format(Path("model.pt")) == ModelFormat.PYTORCH
        assert _detect_source_format(Path("model.safetensors")) == ModelFormat.SAFETENSORS
        assert _detect_source_format(Path("model.engine")) == ModelFormat.TENSORRT
        assert _detect_source_format(Path("model.mlmodel")) == ModelFormat.COREML

    def test_detect_source_format_unknown(self):
        from openeye_ai.mlops.export import _detect_source_format

        with pytest.raises(ValueError, match="Unrecognized"):
            _detect_source_format(Path("model.xyz"))

    def test_list_exports_empty(self):
        from openeye_ai.mlops.export import list_exports

        assert list_exports() == []

    def test_detect_source_format_pth(self):
        from openeye_ai.mlops.export import _detect_source_format
        from openeye_ai.mlops.schemas import ModelFormat

        assert _detect_source_format(Path("model.pth")) == ModelFormat.PYTORCH

    def test_detect_source_format_trt(self):
        from openeye_ai.mlops.export import _detect_source_format
        from openeye_ai.mlops.schemas import ModelFormat

        assert _detect_source_format(Path("model.trt")) == ModelFormat.TENSORRT
