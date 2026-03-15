"""Tests for YAML config loading and validation."""

import pytest
import tempfile
from pathlib import Path

from governance.loader import load_yaml, load_preset, list_presets, validate_yaml, resolve_config
from governance.models import GovernanceConfig, PolicyConfig


class TestLoadYAML:
    def test_load_valid_yaml(self, tmp_path):
        yaml_content = """
version: "1.0"
name: "test"
domain: "robotics"
policies:
  - name: "zone1"
    type: "zone_policy"
    enabled: true
    config:
      zones: []
settings:
  log_all_decisions: true
  fail_open: false
"""
        path = tmp_path / "test.yaml"
        path.write_text(yaml_content)
        config = load_yaml(path)
        assert config.name == "test"
        assert config.domain.value == "robotics"
        assert len(config.policies) == 1

    def test_load_missing_file(self):
        with pytest.raises(FileNotFoundError):
            load_yaml("/nonexistent/path.yaml")

    def test_load_empty_file(self, tmp_path):
        path = tmp_path / "empty.yaml"
        path.write_text("")
        with pytest.raises(ValueError, match="Empty"):
            load_yaml(path)


class TestPresets:
    def test_list_presets(self):
        presets = list_presets()
        assert isinstance(presets, list)
        assert "minimal" in presets
        assert "robotics_safety" in presets
        assert "desktop_privacy" in presets

    def test_load_robotics_safety(self):
        config = load_preset("robotics_safety")
        assert config.name == "robotics_safety"
        assert len(config.policies) > 0

    def test_load_minimal(self):
        config = load_preset("minimal")
        assert config.name == "minimal"
        assert config.settings.fail_open is True

    def test_load_nonexistent_preset(self):
        with pytest.raises(FileNotFoundError):
            load_preset("nonexistent_preset_xyz")


class TestValidateYAML:
    def test_validate_valid(self, tmp_path):
        yaml_content = """
version: "1.0"
name: "test"
policies: []
"""
        path = tmp_path / "valid.yaml"
        path.write_text(yaml_content)
        valid, msg = validate_yaml(path)
        assert valid is True

    def test_validate_invalid_yaml(self, tmp_path):
        path = tmp_path / "bad.yaml"
        path.write_text("{{{{invalid yaml")
        valid, msg = validate_yaml(path)
        assert valid is False
        assert "YAML" in msg or "parse" in msg.lower() or "error" in msg.lower()


class TestResolveConfig:
    def test_resolve_extends_preset(self):
        config = GovernanceConfig(
            name="custom",
            extends=["minimal"],
            policies=[
                PolicyConfig(name="custom_zone", type="zone_policy", config={"zones": []}),
            ],
        )
        resolved = resolve_config(config)
        assert resolved.extends == []
        # Should have minimal's policies + custom
        policy_names = [p.name for p in resolved.policies]
        assert "custom_zone" in policy_names

    def test_child_overrides_parent(self):
        config = GovernanceConfig(
            name="custom",
            extends=["minimal"],
            policies=[
                PolicyConfig(name="audit_actions", type="action_filter", config={"deny_patterns": ["throw"]}),
            ],
        )
        resolved = resolve_config(config)
        audit_policy = next(p for p in resolved.policies if p.name == "audit_actions")
        assert audit_policy.config.get("deny_patterns") == ["throw"]
