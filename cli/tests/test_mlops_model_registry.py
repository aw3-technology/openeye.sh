"""Tests for openeye_ai.mlops.model_registry — upload, versioning, listing."""

from __future__ import annotations

import pytest


class TestModelRegistry:
    def test_compute_checksum(self, tmp_path):
        from openeye_ai.mlops.model_registry import _compute_checksum

        f = tmp_path / "data.bin"
        f.write_bytes(b"hello world")
        h = _compute_checksum(f)
        assert len(h) == 64  # SHA-256 hex digest

    def test_upload_and_list(self, model_file):
        from openeye_ai.mlops.model_registry import list_registered_models, upload_and_register
        from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

        upload_and_register(
            ModelUploadRequest(
                name="UploadTest", key="upload-test", format=ModelFormat.PYTORCH,
                task="detection", file_path=str(model_file),
            )
        )
        models = list_registered_models()
        assert any(m.key == "upload-test" for m in models)

    def test_upload_wrong_extension(self, tmp_path):
        from openeye_ai.mlops.model_registry import upload_and_register
        from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

        f = tmp_path / "model.txt"
        f.write_bytes(b"\x00")
        with pytest.raises(ValueError, match="extension"):
            upload_and_register(
                ModelUploadRequest(
                    name="Bad", key="bad-ext", format=ModelFormat.ONNX,
                    task="detection", file_path=str(f),
                )
            )

    def test_upload_missing_file(self):
        from openeye_ai.mlops.model_registry import upload_and_register
        from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

        with pytest.raises(FileNotFoundError):
            upload_and_register(
                ModelUploadRequest(
                    name="Missing", key="missing", format=ModelFormat.PYTORCH,
                    task="detection", file_path="/nonexistent/model.pt",
                )
            )

    def test_upload_duplicate_key(self, _seed_registry, model_file):
        from openeye_ai.mlops.model_registry import upload_and_register
        from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

        with pytest.raises(ValueError, match="already exists"):
            upload_and_register(
                ModelUploadRequest(
                    name="Dup", key="test-model", format=ModelFormat.PYTORCH,
                    task="detection", file_path=str(model_file),
                )
            )

    def test_get_registered_model(self, _seed_registry):
        from openeye_ai.mlops.model_registry import get_registered_model

        entry = get_registered_model("test-model")
        assert entry.name == "Test Model"

    def test_get_registered_model_not_found(self):
        from openeye_ai.mlops.model_registry import get_registered_model

        with pytest.raises(KeyError, match="not in enterprise registry"):
            get_registered_model("nonexistent")

    def test_add_version_and_list(self, _seed_registry, tmp_path):
        from openeye_ai.mlops.model_registry import add_version, list_versions
        from openeye_ai.mlops.schemas import ModelFormat

        f2 = tmp_path / "v2.pt"
        f2.write_bytes(b"\x00" * 512)
        add_version(
            "test-model", file_path=str(f2), version="2.0.0",
            format=ModelFormat.PYTORCH, author="tester",
        )
        versions = list_versions("test-model")
        assert len(versions) == 2
        assert versions[-1].version == "2.0.0"

    def test_add_version_duplicate(self, _seed_registry, tmp_path):
        from openeye_ai.mlops.model_registry import add_version
        from openeye_ai.mlops.schemas import ModelFormat

        f2 = tmp_path / "dup.pt"
        f2.write_bytes(b"\x00" * 512)
        with pytest.raises(ValueError, match="already exists"):
            add_version(
                "test-model", file_path=str(f2), version="1.0.0",
                format=ModelFormat.PYTORCH,
            )

    def test_get_version(self, _seed_registry):
        from openeye_ai.mlops.model_registry import get_version

        v = get_version("test-model", "1.0.0")
        assert v.version == "1.0.0"

    def test_get_version_not_found(self, _seed_registry):
        from openeye_ai.mlops.model_registry import get_version

        with pytest.raises(KeyError, match="not found"):
            get_version("test-model", "9.9.9")

    def test_load_registry_corrupt_entry_skipped(self, tmp_openeye_home):
        """Corrupt entries are skipped, not crash the listing."""
        from openeye_ai.mlops.model_registry import list_registered_models
        from openeye_ai.mlops.persistence import atomic_save_yaml

        registry_path = tmp_openeye_home / "registry.yaml"
        atomic_save_yaml(registry_path, {
            "schema_version": 3,
            "models": {
                "good": {
                    "name": "Good", "task": "detection", "adapter": "yolo",
                    "versions": [],
                },
                "corrupt": "not a dict",
            },
        })
        models = list_registered_models()
        assert len(models) == 1
        assert models[0].key == "good"

    def test_add_version_missing_file(self, _seed_registry):
        from openeye_ai.mlops.model_registry import add_version
        from openeye_ai.mlops.schemas import ModelFormat

        with pytest.raises(FileNotFoundError):
            add_version(
                "test-model", file_path="/nonexistent/v2.pt", version="2.0.0",
                format=ModelFormat.PYTORCH,
            )

    def test_add_version_nonexistent_model(self, tmp_path):
        from openeye_ai.mlops.model_registry import add_version
        from openeye_ai.mlops.schemas import ModelFormat

        f = tmp_path / "v.pt"
        f.write_bytes(b"\x00" * 512)
        with pytest.raises(KeyError, match="not found"):
            add_version(
                "nonexistent-model", file_path=str(f), version="1.0.0",
                format=ModelFormat.PYTORCH,
            )

    def test_list_versions_nonexistent_model(self):
        from openeye_ai.mlops.model_registry import list_versions

        with pytest.raises(KeyError, match="not in enterprise registry"):
            list_versions("nonexistent")

    def test_load_enterprise_registry_non_dict(self, tmp_openeye_home):
        """Registry file containing a non-dict value should be recovered."""
        from openeye_ai.mlops.model_registry import list_registered_models
        from openeye_ai.mlops.persistence import atomic_save_yaml

        registry_path = tmp_openeye_home / "registry.yaml"
        atomic_save_yaml(registry_path, "just a string")
        models = list_registered_models()
        assert models == []

    def test_load_enterprise_registry_missing_models_key(self, tmp_openeye_home):
        """Registry with no 'models' key should not crash."""
        from openeye_ai.mlops.model_registry import list_registered_models
        from openeye_ai.mlops.persistence import atomic_save_yaml

        registry_path = tmp_openeye_home / "registry.yaml"
        atomic_save_yaml(registry_path, {"schema_version": 3})
        models = list_registered_models()
        assert models == []

    def test_add_version_with_training_metrics(self, _seed_registry, tmp_path):
        from openeye_ai.mlops.model_registry import add_version, get_version
        from openeye_ai.mlops.schemas import ModelFormat

        f = tmp_path / "v2.pt"
        f.write_bytes(b"\x00" * 512)
        add_version(
            "test-model", file_path=str(f), version="2.0.0",
            format=ModelFormat.PYTORCH, author="tester",
            training_metrics={"accuracy": 0.95, "loss": 0.1},
        )
        v = get_version("test-model", "2.0.0")
        assert v.training_metrics.accuracy == pytest.approx(0.95)
        assert v.training_metrics.loss == pytest.approx(0.1)
