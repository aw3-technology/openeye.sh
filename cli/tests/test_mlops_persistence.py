"""Tests for openeye_ai.mlops.persistence — atomic YAML save/load."""

from __future__ import annotations


class TestPersistence:
    def test_atomic_save_and_load_yaml(self, tmp_path):
        from openeye_ai.mlops.persistence import atomic_save_yaml, safe_load_yaml

        path = tmp_path / "data.yaml"
        atomic_save_yaml(path, {"key": "value", "items": [1, 2, 3]})
        data = safe_load_yaml(path)
        assert data == {"key": "value", "items": [1, 2, 3]}

    def test_safe_load_yaml_missing_file_returns_default(self, tmp_path):
        from openeye_ai.mlops.persistence import safe_load_yaml

        result = safe_load_yaml(tmp_path / "nope.yaml", default=dict)
        assert result == {}

    def test_safe_load_yaml_corrupt_file(self, tmp_path):
        from openeye_ai.mlops.persistence import safe_load_yaml

        path = tmp_path / "bad.yaml"
        path.write_text("{{{{not: valid: yaml: ][][")
        result = safe_load_yaml(path, default=lambda: {"fallback": True})
        assert result == {"fallback": True}
        # Corrupt file should be backed up
        assert (tmp_path / "bad.yaml.corrupt").exists()

    def test_safe_load_yaml_empty_file_returns_default(self, tmp_path):
        from openeye_ai.mlops.persistence import safe_load_yaml

        path = tmp_path / "empty.yaml"
        path.write_text("")
        result = safe_load_yaml(path, default=lambda: [])
        assert result == []

    def test_safe_load_yaml_list(self, tmp_path):
        from openeye_ai.mlops.persistence import atomic_save_yaml, safe_load_yaml_list

        path = tmp_path / "items.yaml"
        atomic_save_yaml(path, [{"a": 1}, {"b": 2}])
        result = safe_load_yaml_list(path)
        assert len(result) == 2
        assert result[0] == {"a": 1}

    def test_safe_load_yaml_list_non_list_returns_empty(self, tmp_path):
        from openeye_ai.mlops.persistence import safe_load_yaml_list

        path = tmp_path / "notlist.yaml"
        path.write_text("key: value\n")
        result = safe_load_yaml_list(path)
        assert result == []

    def test_atomic_save_creates_parent_dirs(self, tmp_path):
        from openeye_ai.mlops.persistence import atomic_save_yaml

        path = tmp_path / "deep" / "nested" / "dir" / "data.yaml"
        atomic_save_yaml(path, {"ok": True})
        assert path.exists()

    def test_safe_load_yaml_none_default(self, tmp_path):
        """When default is None (the default), missing file returns empty dict."""
        from openeye_ai.mlops.persistence import safe_load_yaml

        result = safe_load_yaml(tmp_path / "nope.yaml")
        assert result == {}

    def test_safe_load_yaml_non_callable_default(self, tmp_path):
        """Non-callable defaults are returned as-is."""
        from openeye_ai.mlops.persistence import safe_load_yaml

        result = safe_load_yaml(tmp_path / "nope.yaml", default={"fallback": True})
        assert result == {"fallback": True}

    def test_atomic_save_yaml_preserves_enum(self, tmp_path):
        """Enums should be serialized as their string value."""
        import enum

        from openeye_ai.mlops.persistence import atomic_save_yaml, safe_load_yaml

        class Color(enum.Enum):
            RED = "red"

        path = tmp_path / "enum.yaml"
        atomic_save_yaml(path, {"color": Color.RED})
        data = safe_load_yaml(path)
        assert data["color"] == "red"
