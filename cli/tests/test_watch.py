"""Tests for the watch command (Stories 29-37)."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image
from typer.testing import CliRunner

from openeye_ai.cli import app

runner = CliRunner()

# Module path shorthand for patching
_W = "openeye_ai.commands.inference.watch"


# ── Test Helpers ─────────────────────────────────────────────────────


class _StubAdapter:
    """Minimal adapter that returns configurable dummy detections."""

    def __init__(self, detections: list[dict] | None = None, inference_ms: float = 12.5):
        self._detections = detections or [
            {"label": "person", "confidence": 0.9, "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}},
        ]
        self._inference_ms = inference_ms

    def load(self, model_dir: Path) -> None:
        pass

    def predict(self, image: Any) -> dict:
        return {"objects": self._detections, "inference_ms": self._inference_ms}


class FakeCamera:
    """Camera that yields *n_frames* PIL images then raises KeyboardInterrupt."""

    def __init__(self, n_frames: int = 3):
        self._remaining = n_frames

    def read_pil(self) -> Image.Image | None:
        if self._remaining <= 0:
            raise KeyboardInterrupt
        self._remaining -= 1
        return Image.new("RGB", (64, 64), "blue")

    def release(self) -> None:
        pass


class FailingCamera:
    """Camera whose constructor always raises RuntimeError."""

    def __init__(self, *_a: Any, **_kw: Any):
        raise RuntimeError("No camera device found")


class NoOpLive:
    """Drop-in replacement for ``rich.live.Live`` that does nothing."""

    def __init__(self, **_kw: Any):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *_exc: Any):
        pass

    def update(self, _renderable: Any) -> None:
        pass


# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture()
def watch_env():
    """Patch internals so the watch command runs fast in tests.

    Yields a dict of mocks/stubs for further assertions.
    """
    adapters = {"yolov8": _StubAdapter()}
    cam = FakeCamera(3)

    with (
        patch(f"{_W}._load_adapters", return_value=adapters),
        patch(f"{_W}._init_safety_guardian", return_value=(None, None, None, None)),
        patch(f"{_W}._open_input_source", return_value=(cam, "camera 0")),
        patch(f"{_W}.time.sleep"),
        patch("rich.live.Live", NoOpLive),
    ):
        yield {"adapters": adapters, "cam": cam}


# ── Story 29: Rich TUI with live detections ──────────────────────────


class TestStory29BasicTUI:
    def test_basic_run_and_exit(self, watch_env):
        result = runner.invoke(app, ["watch"])
        assert result.exit_code == 0

    def test_header_shows_live_model_source(self, watch_env):
        result = runner.invoke(app, ["watch"])
        assert "LIVE" in result.output
        assert "yolov8" in result.output
        assert "camera 0" in result.output


# ── Story 30: --video video file input ───────────────────────────────


class TestStory30VideoInput:
    def test_video_option_uses_video_player(self):
        """When --video is given, _open_input_source creates a VideoPlayer."""
        mock_vp = MagicMock()
        with (
            patch("openeye_ai.utils.camera.VideoPlayer", return_value=mock_vp) as vp_cls,
            patch("openeye_ai.utils.camera.Camera") as cam_cls,
        ):
            from openeye_ai.commands.inference.watch import _open_input_source

            src, label = _open_input_source(0, "/tmp/demo.mp4")

        vp_cls.assert_called_once_with("/tmp/demo.mp4")
        cam_cls.assert_not_called()
        assert "video" in label
        assert src is mock_vp

    def test_missing_video_falls_back_to_camera(self):
        """If --video file doesn't exist, fall back to camera."""
        mock_cam = MagicMock()
        with (
            patch(
                "openeye_ai.utils.camera.VideoPlayer",
                side_effect=FileNotFoundError("not found"),
            ),
            patch("openeye_ai.utils.camera.Camera", return_value=mock_cam),
        ):
            from openeye_ai.commands.inference.watch import _open_input_source

            src, label = _open_input_source(0, "/tmp/missing.mp4")

        assert src is mock_cam
        assert "camera" in label


# ── Story 31: multi-model ────────────────────────────────────────────


class TestStory31MultiModel:
    def test_multi_model_loads_both(self, watch_env):
        adapters = {
            "yolov8": _StubAdapter(),
            "depth-anything": _StubAdapter(detections=[], inference_ms=8.0),
        }
        with patch(f"{_W}._load_adapters", return_value=adapters):
            result = runner.invoke(app, ["watch", "-m", "yolov8,depth-anything"])
        assert result.exit_code == 0


# ── Story 32: --safety overlay ───────────────────────────────────────


class TestStory32SafetyOverlay:
    def test_safety_continues_without_backend(self, watch_env):
        """When --safety is passed but guardian init fails, watch still runs."""
        result = runner.invoke(app, ["watch", "--safety"])
        assert result.exit_code == 0

    def test_invalid_thresholds_rejected(self):
        """danger-m >= caution-m should fail fast."""
        result = runner.invoke(
            app, ["watch", "--safety", "--danger-m", "2.0", "--caution-m", "1.0"]
        )
        assert result.exit_code == 1
        assert "danger-m" in result.output


# ── Story 33: custom thresholds ──────────────────────────────────────


class TestStory33Thresholds:
    def test_custom_thresholds_accepted(self, watch_env):
        result = runner.invoke(
            app, ["watch", "--safety", "--danger-m", "1.0", "--caution-m", "3.0"]
        )
        assert result.exit_code == 0

    def test_equal_thresholds_rejected(self):
        result = runner.invoke(
            app, ["watch", "--safety", "--danger-m", "2.0", "--caution-m", "2.0"]
        )
        assert result.exit_code == 1
        assert "danger-m" in result.output


# ── Story 34: FPS / latency display ─────────────────────────────────


class TestStory34FPSLatency:
    def test_output_contains_fps_and_latency(self, watch_env):
        result = runner.invoke(app, ["watch"])
        output = result.output
        assert "FPS" in output or "fps" in output.lower()
        assert "ms" in output


# ── Story 35: session summary ────────────────────────────────────────


class TestStory35SessionSummary:
    def test_summary_shows_total_frames(self, watch_env):
        result = runner.invoke(app, ["watch"])
        assert "Total frames" in result.output
        assert "3" in result.output  # FakeCamera yields 3 frames

    def test_summary_shows_runtime(self, watch_env):
        result = runner.invoke(app, ["watch"])
        assert "Runtime" in result.output

    def test_summary_shows_avg_fps(self, watch_env):
        result = runner.invoke(app, ["watch"])
        assert "Avg FPS" in result.output

    def test_summary_shows_avg_latency(self, watch_env):
        result = runner.invoke(app, ["watch"])
        assert "Avg latency" in result.output

    def test_summary_shows_total_detections(self, watch_env):
        result = runner.invoke(app, ["watch"])
        assert "Total detections" in result.output

    def test_safety_stats_when_safety_enabled(self, watch_env):
        result = runner.invoke(app, ["watch", "--safety"])
        assert "Danger events" in result.output
        assert "Caution events" in result.output

    def test_no_safety_stats_without_flag(self, watch_env):
        result = runner.invoke(app, ["watch"])
        assert "Danger events" not in result.output


# ── Story 36: external USB camera ────────────────────────────────────


class TestStory36ExternalCamera:
    def test_camera_index_passed(self):
        """Passing -c 1 should open Camera(1)."""
        mock_cam = MagicMock()
        with patch("openeye_ai.utils.camera.Camera", return_value=mock_cam) as cam_cls:
            from openeye_ai.commands.inference.watch import _open_input_source

            _open_input_source(1, None)

        cam_cls.assert_called_once_with(1)

    def test_negative_camera_rejected(self):
        result = runner.invoke(app, ["watch", "-c", "-1"])
        assert result.exit_code == 1
        assert "Invalid camera index" in result.output


# ── Story 37: graceful fallback to demo video ────────────────────────


class TestStory37DemoFallback:
    def test_camera_fail_uses_demo_video(self, tmp_path):
        """When camera fails and no --video, fall back to ~/.openeye/demo.mp4."""
        demo_mp4 = tmp_path / "demo.mp4"
        demo_mp4.touch()

        mock_vp = MagicMock()
        with (
            patch(
                "openeye_ai.utils.camera.Camera",
                side_effect=RuntimeError("no cam"),
            ),
            patch("openeye_ai.utils.camera.VideoPlayer", return_value=mock_vp),
            patch(f"{_W}._find_demo_video", return_value=demo_mp4),
        ):
            from openeye_ai.commands.inference.watch import _open_input_source

            src, label = _open_input_source(0, None)

        assert src is mock_vp
        assert "demo" in label

    def test_no_demo_exits_with_code_1(self):
        """When camera fails and no demo video exists, exit 1."""
        from click.exceptions import Exit as ClickExit

        with (
            patch(
                "openeye_ai.utils.camera.Camera",
                side_effect=RuntimeError("no cam"),
            ),
            patch(f"{_W}._find_demo_video", return_value=None),
        ):
            from openeye_ai.commands.inference.watch import _open_input_source

            with pytest.raises(ClickExit):
                _open_input_source(0, None)

    def test_video_flag_fallback_on_camera_fail(self):
        """When camera fails but --video is given, use that video."""
        mock_vp = MagicMock()
        with (
            patch(
                "openeye_ai.utils.camera.Camera",
                side_effect=RuntimeError("no cam"),
            ),
            patch("openeye_ai.utils.camera.VideoPlayer", return_value=mock_vp),
        ):
            from openeye_ai.commands.inference.watch import _open_input_source

            src, label = _open_input_source(0, "/tmp/fallback.mp4")

        assert src is mock_vp
        assert "video" in label

    def test_find_demo_video_returns_path(self, tmp_path):
        """_find_demo_video finds ~/.openeye/demo.mp4."""
        demo = tmp_path / "demo.mp4"
        demo.touch()
        with patch(f"{_W}.OPENEYE_HOME", tmp_path):
            from openeye_ai.commands.inference.watch import _find_demo_video

            result = _find_demo_video()

        assert result == demo

    def test_find_demo_video_returns_none(self, tmp_path):
        """_find_demo_video returns None when no demo exists."""
        with patch(f"{_W}.OPENEYE_HOME", tmp_path):
            from openeye_ai.commands.inference.watch import _find_demo_video

            result = _find_demo_video()

        assert result is None


# ── Edge cases ───────────────────────────────────────────────────────


class TestEdgeCases:
    def test_model_not_downloaded(self):
        """Model not downloaded should exit 1 with helpful message."""
        with (
            patch(f"{_W}.get_model_info", return_value={"name": "YOLOv8"}),
            patch(f"{_W}.is_downloaded", return_value=False),
        ):
            result = runner.invoke(app, ["watch"])
        assert result.exit_code == 1
        assert "not downloaded" in result.output

    def test_unknown_model(self):
        """Unknown model key should exit 1."""
        with patch(f"{_W}.get_model_info", side_effect=KeyError("'nope' not found")):
            result = runner.invoke(app, ["watch", "-m", "nope"])
        assert result.exit_code == 1

    def test_dropped_frames_exceeding_threshold(self):
        """After 30+ consecutive None frames, watch exits gracefully."""

        class DroppingCamera:
            def read_pil(self):
                return None

            def release(self):
                pass

        adapters = {"yolov8": _StubAdapter()}
        with (
            patch(f"{_W}._load_adapters", return_value=adapters),
            patch(f"{_W}._init_safety_guardian", return_value=(None, None, None, None)),
            patch(f"{_W}._open_input_source", return_value=(DroppingCamera(), "camera 0")),
            patch(f"{_W}.time.sleep"),
            patch("rich.live.Live", NoOpLive),
        ):
            result = runner.invoke(app, ["watch"])

        assert result.exit_code == 0
        assert "stopped responding" in result.output
