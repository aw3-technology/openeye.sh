"""Tests for config module."""

from openeye_ai import config


def test_ensure_dirs_creates_models_dir(tmp_openeye_home):
    models = tmp_openeye_home / "models"
    assert not models.exists()
    config.ensure_dirs()
    assert models.exists()
    assert models.is_dir()


def test_ensure_dirs_idempotent(tmp_openeye_home):
    config.ensure_dirs()
    config.ensure_dirs()  # should not raise
    assert (tmp_openeye_home / "models").is_dir()


def test_path_constants_are_paths():
    assert hasattr(config, "OPENEYE_HOME")
    assert hasattr(config, "MODELS_DIR")
    assert hasattr(config, "CONFIG_PATH")
    assert hasattr(config, "REGISTRY_FILENAME")


def test_load_config_returns_empty_when_missing(tmp_openeye_home):
    result = config.load_config()
    assert result == {}


def test_load_config_returns_empty_for_non_dict_yaml(tmp_openeye_home):
    """If YAML contains a list or scalar, load_config returns {}."""
    config.ensure_dirs()
    config.CONFIG_PATH.write_text("- item1\n- item2\n")
    result = config.load_config()
    assert result == {}


def test_load_config_returns_empty_for_scalar_yaml(tmp_openeye_home):
    config.ensure_dirs()
    config.CONFIG_PATH.write_text("just a string\n")
    result = config.load_config()
    assert result == {}


def test_load_config_returns_empty_for_null_yaml(tmp_openeye_home):
    config.ensure_dirs()
    config.CONFIG_PATH.write_text("")
    result = config.load_config()
    assert result == {}


def test_save_and_load_config(tmp_openeye_home):
    config.ensure_dirs()
    config.save_config({"key": "value"})
    result = config.load_config()
    assert result == {"key": "value"}


def test_save_config_overwrites_existing(tmp_openeye_home):
    config.ensure_dirs()
    config.save_config({"a": 1})
    config.save_config({"b": 2})
    result = config.load_config()
    assert result == {"b": 2}
    assert "a" not in result


def test_save_config_with_nested_data(tmp_openeye_home):
    config.ensure_dirs()
    data = {"models": {"yolo": {"threshold": 0.5}}, "count": 3}
    config.save_config(data)
    assert config.load_config() == data


def test_save_config_creates_dirs(tmp_openeye_home):
    """save_config calls ensure_dirs, so parent dirs are created."""
    config.save_config({"key": "val"})
    assert config.load_config() == {"key": "val"}


def test_get_set_config_value(tmp_openeye_home):
    config.ensure_dirs()
    assert config.get_config_value("missing") is None
    config.set_config_value("foo", 42)
    assert config.get_config_value("foo") == 42


def test_set_config_value_overwrites(tmp_openeye_home):
    config.ensure_dirs()
    config.set_config_value("key", "old")
    config.set_config_value("key", "new")
    assert config.get_config_value("key") == "new"


def test_set_config_value_preserves_others(tmp_openeye_home):
    config.ensure_dirs()
    config.set_config_value("a", 1)
    config.set_config_value("b", 2)
    assert config.get_config_value("a") == 1
    assert config.get_config_value("b") == 2


def test_set_config_value_none(tmp_openeye_home):
    config.ensure_dirs()
    config.set_config_value("key", None)
    assert config.get_config_value("key") is None


def test_config_special_characters_in_values(tmp_openeye_home):
    config.ensure_dirs()
    config.set_config_value("path", "/tmp/some path/with spaces")
    assert config.get_config_value("path") == "/tmp/some path/with spaces"
