"""Tests for Installation & Setup user stories (1–8).

Covers zero-config first experience, pull with checksum, pull --all,
config persistence, optional extras errors, no-subcommand help,
NEBIUS_API_KEY, and update-registry.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

from openeye_ai.cli import app

from conftest import StubAdapter, make_test_registry

runner = CliRunner()


def _make_registry(downloaded: set[str] | None = None) -> dict[str, dict[str, Any]]:
    return make_test_registry(include_checksum=True, variant_style="quantized")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Story 1: pip install + openeye list — zero-config first experience
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStory1ZeroConfigList:
    """As a developer, I can pip install openeye-sh and run openeye list
    within 60 seconds — zero-config first experience."""

    def test_list_works_without_prior_config(self, tmp_openeye_home, monkeypatch):
        """list command works on a fresh install with no config file."""
        registry = _make_registry()
        monkeypatch.setattr("openeye_ai.commands.models.load_registry", lambda: registry)
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda k: False)
        monkeypatch.setattr("openeye_ai.commands.models.is_variant_downloaded", lambda k, v: False)

        result = runner.invoke(app, ["list"])
        assert result.exit_code == 0
        assert "yolov8" in result.output
        assert "depth-anything" in result.output

    def test_list_shows_all_registry_models(self, tmp_openeye_home, monkeypatch):
        """All models in registry appear in the table."""
        registry = _make_registry()
        monkeypatch.setattr("openeye_ai.commands.models.load_registry", lambda: registry)
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda k: False)
        monkeypatch.setattr("openeye_ai.commands.models.is_variant_downloaded", lambda k, v: False)

        result = runner.invoke(app, ["list"])
        assert result.exit_code == 0
        for key in registry:
            assert key in result.output

    def test_list_shows_status_column(self, tmp_openeye_home, monkeypatch):
        """Downloaded models are marked as downloaded, others as available."""
        registry = _make_registry()
        monkeypatch.setattr("openeye_ai.commands.models.load_registry", lambda: registry)
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda k: k == "yolov8")
        monkeypatch.setattr("openeye_ai.commands.models.is_variant_downloaded", lambda k, v: False)

        result = runner.invoke(app, ["list"])
        assert result.exit_code == 0
        output_lower = result.output.lower()
        # Rich may truncate to "download…" or "availa…" in narrow terminals
        assert "download" in output_lower or "availa" in output_lower

    def test_ensure_dirs_creates_models_dir_on_first_run(self, tmp_openeye_home):
        """Calling any command auto-creates ~/.openeye/models/."""
        from openeye_ai.config import ensure_dirs

        models_dir = tmp_openeye_home / "models"
        assert not models_dir.exists()
        ensure_dirs()
        assert models_dir.is_dir()

    def test_list_shows_size_and_task(self, tmp_openeye_home, monkeypatch):
        """list output includes model size and task info."""
        registry = _make_registry()
        monkeypatch.setattr("openeye_ai.commands.models.load_registry", lambda: registry)
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda k: False)
        monkeypatch.setattr("openeye_ai.commands.models.is_variant_downloaded", lambda k, v: False)

        result = runner.invoke(app, ["list"])
        assert result.exit_code == 0
        # Rich may truncate to "detecti…" in narrow terminals
        output = result.output
        assert "detect" in output
        assert "depth" in output


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Story 2: pull with verified checksum
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStory2PullWithChecksum:
    """As a developer, I can run openeye pull yolov8 and get a working model
    with verified checksum — no manual downloads."""

    def test_pull_downloads_and_verifies_checksum(self, tmp_openeye_home, monkeypatch, patch_disk_space):
        """Successful pull verifies checksum and creates .pulled marker."""
        registry = _make_registry()
        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
        monkeypatch.setattr("openeye_ai.commands.models.get_adapter", lambda m, variant=None: StubAdapter())
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")
        monkeypatch.setattr("openeye_ai.utils.checksum.verify_checksum", lambda *a, **kw: True)
        monkeypatch.setattr("openeye_ai.utils.download.mark_pulled", lambda d: None)

        result = runner.invoke(app, ["pull", "yolov8"])
        assert result.exit_code == 0
        assert "Successfully pulled" in result.output

    def test_pull_fails_on_checksum_mismatch(self, tmp_openeye_home, monkeypatch, patch_disk_space):
        """Pull exits with error when checksum verification fails."""
        registry = _make_registry()
        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
        monkeypatch.setattr("openeye_ai.commands.models.get_adapter", lambda m, variant=None: StubAdapter())
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")
        monkeypatch.setattr("openeye_ai.utils.checksum.verify_checksum", lambda *a, **kw: False)

        result = runner.invoke(app, ["pull", "yolov8"])
        assert result.exit_code == 1
        assert "Checksum" in result.output

    def test_pull_unknown_model_errors(self, tmp_openeye_home, monkeypatch):
        """Pulling an unknown model name results in an error exit."""
        monkeypatch.setattr(
            "openeye_ai.commands.models.get_model_info",
            lambda m: (_ for _ in ()).throw(KeyError(f"Unknown model '{m}'")),
        )

        result = runner.invoke(app, ["pull", "nonexistent"])
        assert result.exit_code == 1

    def test_pull_skips_when_already_downloaded(self, tmp_openeye_home, monkeypatch):
        """Pulling an already-downloaded model reports it and exits cleanly."""
        registry = _make_registry()
        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: True)
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")

        result = runner.invoke(app, ["pull", "yolov8"])
        assert result.exit_code == 0
        assert "already downloaded" in result.output

    def test_pull_force_redownloads(self, tmp_openeye_home, monkeypatch, patch_disk_space):
        """--force flag forces re-download even if already present."""
        registry = _make_registry()
        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: True)
        monkeypatch.setattr("openeye_ai.commands.models.get_adapter", lambda m, variant=None: StubAdapter())
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")
        monkeypatch.setattr("openeye_ai.utils.checksum.verify_checksum", lambda *a, **kw: True)
        monkeypatch.setattr("openeye_ai.utils.download.mark_pulled", lambda d: None)

        result = runner.invoke(app, ["pull", "yolov8", "--force"])
        assert result.exit_code == 0
        assert "Force re-downloading" in result.output or "Successfully pulled" in result.output

    def test_pull_checks_disk_space(self, tmp_openeye_home, monkeypatch):
        """Pull fails gracefully when disk space is insufficient."""
        registry = _make_registry()
        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")
        # Report very little free space (1 MB)
        monkeypatch.setattr(
            "shutil.disk_usage",
            lambda p: shutil._ntuple_diskusage(100 * 1024**3, 99 * 1024**3, 1 * 1024**2),
        )

        result = runner.invoke(app, ["pull", "yolov8"])
        assert result.exit_code == 1
        assert "disk space" in result.output.lower() or "Insufficient" in result.output


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Story 3: pull --all with progress and resume on failure
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStory3PullAll:
    """As a developer, I can run openeye pull --all and have every model
    downloaded with progress bars and resume on failure."""

    def test_pull_all_downloads_every_model(self, tmp_openeye_home, monkeypatch, patch_disk_space):
        """--all flag pulls all models in the registry."""
        registry = _make_registry()
        pulled: list[str] = []

        monkeypatch.setattr("openeye_ai.commands.models.load_registry", lambda: registry)
        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
        monkeypatch.setattr("openeye_ai.commands.models.get_adapter", lambda m, variant=None: StubAdapter(track_pulls=pulled))
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")
        monkeypatch.setattr("openeye_ai.utils.checksum.verify_checksum", lambda *a, **kw: True)
        monkeypatch.setattr("openeye_ai.utils.download.mark_pulled", lambda d: None)

        result = runner.invoke(app, ["pull", "--all"])
        assert result.exit_code == 0
        assert "All models pulled" in result.output
        assert len(pulled) == len(registry)

    def test_pull_all_reports_failures(self, tmp_openeye_home, monkeypatch, patch_disk_space):
        """--all reports which models failed but continues with the rest."""
        registry = _make_registry()

        monkeypatch.setattr("openeye_ai.commands.models.load_registry", lambda: registry)
        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
        monkeypatch.setattr("openeye_ai.commands.models.get_adapter", lambda m, variant=None: StubAdapter(fail_on="depth"))
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")
        monkeypatch.setattr("openeye_ai.utils.checksum.verify_checksum", lambda *a, **kw: True)
        monkeypatch.setattr("openeye_ai.utils.download.mark_pulled", lambda d: None)

        result = runner.invoke(app, ["pull", "--all"])
        assert result.exit_code == 1
        assert "Failed to pull" in result.output

    def test_pull_all_with_variant_filter(self, tmp_openeye_home, monkeypatch, patch_disk_space):
        """--all --variant quantized only pulls models with that variant."""
        registry = _make_registry()
        pulled_models: list[str] = []

        monkeypatch.setattr("openeye_ai.commands.models.load_registry", lambda: registry)
        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.get_variant_info", lambda m, v: {**registry[m], "_variant": v})
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
        monkeypatch.setattr("openeye_ai.commands.models.is_variant_downloaded", lambda m, v: False)
        monkeypatch.setattr("openeye_ai.commands.models.get_adapter", lambda m, variant=None: StubAdapter(track_pulls=pulled_models))
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")
        monkeypatch.setattr("openeye_ai.utils.checksum.verify_checksum", lambda *a, **kw: True)
        monkeypatch.setattr("openeye_ai.utils.download.mark_pulled", lambda d: None)

        result = runner.invoke(app, ["pull", "--all", "--variant", "quantized"])
        assert result.exit_code == 0
        # Only yolov8 has a quantized variant in our fixture
        assert len(pulled_models) == 1
        assert "yolov8" in pulled_models[0]

    def test_pull_resume_partial_download(self, tmp_openeye_home, monkeypatch, patch_disk_space):
        """If model dir exists without .pulled marker, shows resume message."""
        registry = _make_registry()
        models_dir = tmp_openeye_home / "models"
        partial_dir = models_dir / "yolov8"
        partial_dir.mkdir(parents=True)
        # Directory exists but no .pulled marker — partial download

        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
        monkeypatch.setattr("openeye_ai.commands.models.get_adapter", lambda m, variant=None: StubAdapter())
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", models_dir)
        monkeypatch.setattr("openeye_ai.utils.checksum.verify_checksum", lambda *a, **kw: True)
        monkeypatch.setattr("openeye_ai.utils.download.mark_pulled", lambda d: None)

        result = runner.invoke(app, ["pull", "yolov8"])
        assert result.exit_code == 0
        assert "Resuming" in result.output

    def test_pull_no_model_no_all_errors(self, tmp_openeye_home):
        """Running pull with no model name and no --all gives an error."""
        result = runner.invoke(app, ["pull"])
        assert result.exit_code == 1
        assert "Provide a model name" in result.output


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Story 4: config set/get persists across sessions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStory4ConfigPersistence:
    """As a developer, I can run openeye config set default_model yolov8
    and have it persist across sessions."""

    def test_config_set_and_get_roundtrip(self, tmp_openeye_home):
        """Config set followed by config get returns the same value."""
        from openeye_ai import config

        config.ensure_dirs()
        config.set_config_value("default_model", "yolov8")
        assert config.get_config_value("default_model") == "yolov8"

    def test_config_persists_to_yaml_file(self, tmp_openeye_home):
        """Config values are persisted to disk as YAML."""
        from openeye_ai import config

        config.ensure_dirs()
        config.set_config_value("default_model", "yolov8")

        # Read the file directly to confirm persistence
        import yaml

        with open(config.CONFIG_PATH) as f:
            data = yaml.safe_load(f)
        assert data["default_model"] == "yolov8"

    def test_config_survives_reload(self, tmp_openeye_home):
        """Values survive save → load cycle (simulating session restart)."""
        from openeye_ai import config

        config.ensure_dirs()
        config.set_config_value("default_model", "yolov8")
        config.set_config_value("device", "gpu")

        # Simulate new session by loading fresh
        loaded = config.load_config()
        assert loaded["default_model"] == "yolov8"
        assert loaded["device"] == "gpu"

    def test_config_overwrite_existing_key(self, tmp_openeye_home):
        """Overwriting an existing key updates the value."""
        from openeye_ai import config

        config.ensure_dirs()
        config.set_config_value("default_model", "yolov8")
        config.set_config_value("default_model", "depth-anything")
        assert config.get_config_value("default_model") == "depth-anything"

    def test_config_set_preserves_other_keys(self, tmp_openeye_home):
        """Setting one key doesn't clobber other existing keys."""
        from openeye_ai import config

        config.ensure_dirs()
        config.set_config_value("default_model", "yolov8")
        config.set_config_value("device", "gpu")
        assert config.get_config_value("default_model") == "yolov8"
        assert config.get_config_value("device") == "gpu"

    def test_config_get_missing_key_returns_none(self, tmp_openeye_home):
        """Getting an unset key returns None."""
        from openeye_ai import config

        config.ensure_dirs()
        assert config.get_config_value("nonexistent") is None

    def test_config_cli_set_and_get(self, tmp_openeye_home, monkeypatch):
        """CLI 'config set' then 'config get' works end-to-end."""
        store: dict[str, Any] = {}
        monkeypatch.setattr("openeye_ai.config.set_config_value", lambda k, v: store.update({k: v}))
        monkeypatch.setattr("openeye_ai.config.get_config_value", lambda k: store.get(k))

        result = runner.invoke(app, ["config", "set", "default_model", "yolov8"])
        assert result.exit_code == 0

        result = runner.invoke(app, ["config", "get", "default_model"])
        assert result.exit_code == 0
        assert "yolov8" in result.output

    def test_config_cli_get_missing_key_errors(self, tmp_openeye_home, monkeypatch):
        """CLI 'config get' for a missing key returns exit code 1."""
        monkeypatch.setattr("openeye_ai.config.get_config_value", lambda k: None)

        result = runner.invoke(app, ["config", "get", "nonexistent"])
        assert result.exit_code == 1
        assert "not set" in result.output


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Story 5: optional extras and clear dependency errors
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStory5OptionalExtras:
    """As a developer, I can install optional model extras
    (pip install openeye-sh[yolo,depth]) and get clear errors if I try
    to use an uninstalled adapter."""

    def test_extras_mapping_covers_all_adapters(self):
        """Every adapter-backed model has an extras mapping entry."""
        from openeye_ai._cli_helpers import _EXTRAS

        expected_models = {"yolov8", "yolo26", "depth-anything", "grounding-dino", "sam2", "rfdetr", "smolvla"}
        assert expected_models.issubset(set(_EXTRAS.keys()))

    def test_extras_mapping_values_are_valid(self):
        """Extras map to valid pip extra names."""
        from openeye_ai._cli_helpers import _EXTRAS

        valid_extras = {"yolo", "depth", "grounding", "sam", "rfdetr", "smolvla"}
        for model, extra in _EXTRAS.items():
            assert extra in valid_extras, f"Model '{model}' maps to unknown extra '{extra}'"

    def test_missing_dependency_shows_install_hint(self, tmp_openeye_home, monkeypatch, patch_disk_space):
        """When adapter import fails, error includes pip install hint."""
        registry = _make_registry()

        def _fail_import(m, variant=None):
            raise ImportError("No module named 'ultralytics'", name="ultralytics")

        monkeypatch.setattr("openeye_ai.commands.models.get_model_info", lambda m: registry[m])
        monkeypatch.setattr("openeye_ai.commands.models.is_downloaded", lambda m: False)
        monkeypatch.setattr("openeye_ai.commands.models.get_adapter", _fail_import)
        monkeypatch.setattr("openeye_ai.commands.models.MODELS_DIR", tmp_openeye_home / "models")

        result = runner.invoke(app, ["pull", "yolov8"])
        assert result.exit_code == 1
        assert "Missing dependencies" in result.output
        assert "pip install" in result.output

    def test_install_hint_includes_correct_extra(self):
        """Install hint for yolov8 references the 'yolo' extra."""
        from openeye_ai._cli_helpers import _install_hint

        hint = _install_hint("yolo")
        assert "yolo" in hint
        assert "pip install" in hint

    def test_dependency_error_helper_exits(self, tmp_openeye_home):
        """dependency_error() prints message and raises typer.Exit."""
        from click.exceptions import Exit as ClickExit

        from openeye_ai._cli_helpers import dependency_error

        exc = ImportError("No module named 'ultralytics'", name="ultralytics")
        with pytest.raises((SystemExit, ClickExit)):
            dependency_error("yolov8", exc)

    def test_run_with_missing_deps_shows_hint(self, tmp_openeye_home, tmp_path, monkeypatch):
        """Running inference with missing deps shows install instructions."""
        import sys

        import openeye_ai.commands.inference.run
        run_mod = sys.modules["openeye_ai.commands.inference.run"]

        registry = _make_registry()
        monkeypatch.setattr(run_mod, "get_model_info", lambda m: registry[m])
        monkeypatch.setattr(run_mod, "is_downloaded", lambda m: True)
        monkeypatch.setattr(run_mod, "MODELS_DIR", tmp_openeye_home / "models")

        def _fail_import(m, variant=None):
            raise ImportError("No module named 'ultralytics'", name="ultralytics")

        monkeypatch.setattr(run_mod, "get_adapter", _fail_import)

        from PIL import Image

        img_path = tmp_path / "test.jpg"
        Image.new("RGB", (10, 10)).save(img_path)

        result = runner.invoke(app, ["run", "yolov8", str(img_path)])
        assert result.exit_code == 1
        assert "Missing dependencies" in result.output or "pip install" in result.output


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Story 6: no subcommand shows helpful usage
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStory6NoSubcommandHelp:
    """As a developer, I can run openeye with no subcommand and get helpful
    usage info, not a stack trace."""

    def test_no_args_shows_help(self):
        """Running openeye with no arguments shows help/usage text (exit 0 or 2)."""
        result = runner.invoke(app, [])
        # Typer with no_args_is_help=True exits with code 0 or 2 depending on version
        assert result.exit_code in (0, 2)
        assert "Usage" in result.output or "usage" in result.output.lower()

    def test_no_args_no_stack_trace(self):
        """No args does not produce a Python traceback."""
        result = runner.invoke(app, [])
        assert "Traceback" not in result.output
        assert "Error" not in result.output or "Usage" in result.output

    def test_help_lists_key_commands(self):
        """Help output includes the key commands users need."""
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        assert "list" in result.output
        assert "pull" in result.output
        assert "run" in result.output
        assert "serve" in result.output

    def test_version_flag_works(self):
        """--version prints version and exits cleanly."""
        result = runner.invoke(app, ["--version"])
        assert result.exit_code == 0
        assert "openeye-sh" in result.output

    def test_help_shows_description(self):
        """Help text includes the project tagline."""
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        assert "Ollama for vision AI" in result.output

    def test_invalid_subcommand_shows_help(self):
        """An invalid subcommand shows an error with usage hints."""
        result = runner.invoke(app, ["nonexistent-command"])
        # Typer shows an error for unknown commands
        assert result.exit_code != 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Story 7: NEBIUS_API_KEY enables VLM features
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStory7NebiusApiKey:
    """As a developer, I can set NEBIUS_API_KEY and immediately use
    VLM features without additional config."""

    def _make_state(self, runtime_config=None):
        """Create a ServerState for testing."""
        from openeye_ai.server.state import ServerState
        from openeye_ai.server.queue import InferenceQueue

        return ServerState(
            adapter=None,
            model_name="test",
            model_info={"name": "test", "task": "detection"},
            inference_queue=InferenceQueue(),
            runtime_config=runtime_config or {},
        )

    def test_nebius_key_resolved_from_env(self, monkeypatch):
        """NEBIUS_API_KEY env var is picked up by resolve_vlm_model."""
        monkeypatch.setenv("NEBIUS_API_KEY", "test-key-123")
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        monkeypatch.delenv("NEBIUS_MODEL", raising=False)

        state = self._make_state()
        api_key, base_url, model = state.resolve_vlm_model()

        assert api_key == "test-key-123"
        assert "nebius" in base_url.lower() or "studio" in base_url.lower()

    def test_default_model_when_no_env(self, monkeypatch):
        """Without NEBIUS_MODEL, a sensible default model is used."""
        monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
        monkeypatch.delenv("NEBIUS_MODEL", raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

        state = self._make_state()
        _, _, model = state.resolve_vlm_model()
        assert "Qwen" in model or "VL" in model  # default is Qwen VL model

    def test_nebius_model_env_override(self, monkeypatch):
        """NEBIUS_MODEL env var overrides the default model."""
        monkeypatch.setenv("NEBIUS_API_KEY", "key")
        monkeypatch.setenv("NEBIUS_MODEL", "MyCustomModel/v1")

        state = self._make_state()
        _, _, model = state.resolve_vlm_model()
        assert model == "MyCustomModel/v1"

    def test_openrouter_detection(self, monkeypatch):
        """OpenRouter model IDs (lowercase org) route to OpenRouter API."""
        monkeypatch.setenv("OPENROUTER_API_KEY", "or-key-123")
        monkeypatch.delenv("NEBIUS_API_KEY", raising=False)

        state = self._make_state(runtime_config={"vlm_model": "meta-llama/llama-3:free"})
        api_key, base_url, model = state.resolve_vlm_model()

        assert api_key == "or-key-123"
        assert "openrouter" in base_url.lower()

    def test_runtime_config_overrides_env(self, monkeypatch):
        """Runtime config vlm_model takes precedence over NEBIUS_MODEL env."""
        monkeypatch.setenv("NEBIUS_API_KEY", "key")
        monkeypatch.setenv("NEBIUS_MODEL", "EnvModel/v1")

        state = self._make_state(runtime_config={"vlm_model": "ConfigModel/v2"})
        _, _, model = state.resolve_vlm_model()
        assert model == "ConfigModel/v2"

    def test_nebius_base_url_customizable(self, monkeypatch):
        """NEBIUS_BASE_URL env var allows custom endpoint."""
        monkeypatch.setenv("NEBIUS_API_KEY", "key")
        monkeypatch.setenv("NEBIUS_BASE_URL", "https://custom.endpoint.com/v1")
        monkeypatch.delenv("NEBIUS_MODEL", raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

        state = self._make_state()
        _, base_url, _ = state.resolve_vlm_model()
        assert base_url == "https://custom.endpoint.com/v1"

    def test_empty_key_when_not_configured(self, monkeypatch):
        """Without any API key set, api_key is empty string (not error)."""
        monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        monkeypatch.delenv("NEBIUS_MODEL", raising=False)

        state = self._make_state()
        api_key, _, _ = state.resolve_vlm_model()
        assert api_key == ""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Story 8: update-registry discovers new models
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStory8UpdateRegistry:
    """As a developer, I can run openeye update-registry and discover
    newly available models from the remote registry."""

    def test_merge_adds_new_models(self):
        """merge_registries adds new models from remote without overwriting local."""
        from openeye_ai.utils.registry_update import merge_registries

        local = {
            "schema_version": 1,
            "models": {
                "yolov8": {"name": "YOLOv8", "task": "detection", "adapter": "yolov8", "description": "det"},
            },
        }
        remote = {
            "schema_version": 2,
            "models": {
                "yolov8": {"name": "YOLOv8-remote", "task": "detection", "adapter": "yolov8", "description": "new"},
                "new-model": {"name": "New", "task": "depth", "adapter": "depth_anything", "description": "new"},
            },
        }

        merged, added = merge_registries(local, remote)
        assert "new-model" in added
        assert len(added) == 1
        # Existing model not overwritten
        assert merged["models"]["yolov8"]["name"] == "YOLOv8"
        # New model added
        assert merged["models"]["new-model"]["name"] == "New"

    def test_merge_updates_schema_version(self):
        """Schema version is bumped if remote is newer."""
        from openeye_ai.utils.registry_update import merge_registries

        local = {"schema_version": 1, "models": {}}
        remote = {"schema_version": 3, "models": {}}

        merged, added = merge_registries(local, remote)
        assert merged["schema_version"] == 3
        assert added == []

    def test_merge_keeps_local_schema_if_higher(self):
        """Schema version stays if local is already newer."""
        from openeye_ai.utils.registry_update import merge_registries

        local = {"schema_version": 5, "models": {}}
        remote = {"schema_version": 3, "models": {}}

        merged, _ = merge_registries(local, remote)
        assert merged["schema_version"] == 5

    def test_merge_no_changes_when_in_sync(self):
        """No models added when local and remote are identical."""
        from openeye_ai.utils.registry_update import merge_registries

        models = {"yolov8": {"name": "YOLOv8", "task": "detection", "adapter": "yolov8", "description": "det"}}
        local = {"schema_version": 1, "models": dict(models)}
        remote = {"schema_version": 1, "models": dict(models)}

        merged, added = merge_registries(local, remote)
        assert added == []

    def test_fetch_remote_registry_validates_response(self):
        """fetch_remote_registry raises on invalid YAML response."""
        from openeye_ai.utils.registry_update import fetch_remote_registry

        with patch("httpx.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.text = "just a string"
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp

            with pytest.raises(ValueError, match="missing 'models' key"):
                fetch_remote_registry("https://example.com/models.yaml")

    def test_fetch_remote_registry_http_error(self):
        """fetch_remote_registry propagates HTTP errors."""
        import httpx

        from openeye_ai.utils.registry_update import fetch_remote_registry

        with patch("httpx.get") as mock_get:
            mock_get.side_effect = httpx.HTTPStatusError(
                "404", request=MagicMock(), response=MagicMock()
            )
            with pytest.raises(httpx.HTTPStatusError):
                fetch_remote_registry("https://example.com/models.yaml")

    def test_update_registry_cli_success(self, tmp_openeye_home, monkeypatch):
        """CLI update-registry command reports added models."""
        monkeypatch.setattr(
            "openeye_ai.utils.registry_update.update_registry_from_remote",
            lambda path: ["new-model-a", "new-model-b"],
        )
        # Patch the import path used in the CLI command
        monkeypatch.setattr(
            "openeye_ai.commands.models.update_registry_from_remote",
            lambda path: ["new-model-a", "new-model-b"],
            raising=False,
        )

        result = runner.invoke(app, ["update-registry"])
        assert result.exit_code == 0
        assert "new-model-a" in result.output or "2" in result.output

    def test_update_registry_cli_up_to_date(self, tmp_openeye_home, monkeypatch):
        """CLI update-registry reports 'up to date' when no new models."""
        monkeypatch.setattr(
            "openeye_ai.utils.registry_update.update_registry_from_remote",
            lambda path: [],
        )
        monkeypatch.setattr(
            "openeye_ai.commands.models.update_registry_from_remote",
            lambda path: [],
            raising=False,
        )

        result = runner.invoke(app, ["update-registry"])
        assert result.exit_code == 0
        assert "up to date" in result.output

    def test_update_registry_cli_network_error(self, tmp_openeye_home, monkeypatch):
        """CLI update-registry handles network errors gracefully."""

        def _fail(path):
            raise ConnectionError("Network unreachable")

        monkeypatch.setattr(
            "openeye_ai.utils.registry_update.update_registry_from_remote",
            _fail,
        )
        monkeypatch.setattr(
            "openeye_ai.commands.models.update_registry_from_remote",
            _fail,
            raising=False,
        )

        result = runner.invoke(app, ["update-registry"])
        assert result.exit_code == 1
        assert "failed" in result.output.lower() or "error" in result.output.lower()

    def test_update_registry_full_roundtrip(self, tmp_path):
        """Full roundtrip: write local YAML, merge remote, verify file updated."""
        import yaml

        from openeye_ai.utils.registry_update import merge_registries

        local = {
            "schema_version": 1,
            "registry_url": "https://example.com/models.yaml",
            "models": {
                "yolov8": {"name": "YOLOv8", "task": "detection", "adapter": "yolov8", "description": "det"},
            },
        }

        registry_path = tmp_path / "models.yaml"
        with open(registry_path, "w") as f:
            yaml.safe_dump(local, f)

        remote = {
            "schema_version": 2,
            "models": {
                "yolov8": {"name": "YOLOv8", "task": "detection", "adapter": "yolov8", "description": "det"},
                "sam2": {"name": "SAM 2", "task": "segmentation", "adapter": "sam2", "description": "seg"},
            },
        }

        merged, added = merge_registries(local, remote)
        assert "sam2" in added

        # Write merged back (simulating what update_registry_from_remote does)
        with open(registry_path, "w") as f:
            yaml.safe_dump(merged, f)

        # Re-read and verify
        with open(registry_path) as f:
            reloaded = yaml.safe_load(f)
        assert "sam2" in reloaded["models"]
        assert reloaded["models"]["yolov8"]["name"] == "YOLOv8"  # not overwritten
        assert reloaded["schema_version"] == 2
