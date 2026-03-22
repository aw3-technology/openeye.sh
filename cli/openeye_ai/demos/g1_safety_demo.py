#!/usr/bin/env python3
"""Unitree G1 + OpenEye Safety Guardian -- Live Demo

Wires the complete pipeline:
  G1 Camera -> OpenEye Detection -> Safety Guardian -> G1 Halt Signal

Usage:
  # Dry-run mode (no robot needed -- uses laptop webcam)
  python -m openeye_ai.demos.g1_safety_demo

  # Connected to a real G1 over Wi-Fi
  python -m openeye_ai.demos.g1_safety_demo \
      --host 192.168.123.161 \
      --control-mode sdk \
      --transport rtsp

  # With a pre-recorded video fallback
  python -m openeye_ai.demos.g1_safety_demo --video demo_clip.mp4

  # With custom safety zones
  python -m openeye_ai.demos.g1_safety_demo \
      --danger-m 0.8 \
      --caution-m 2.0

The demo detects humans in the camera feed, classifies their proximity zone
(SAFE / CAUTION / DANGER), and sends a halt command to the G1 when someone
enters the danger zone. When the person moves away and stays clear for
--clear-duration seconds, the robot resumes.

Perfect for a 30-second live demo at events.
"""

from __future__ import annotations

import argparse
import logging
import signal
import sys
import time
from pathlib import Path
from typing import Any

from rich.live import Live

from openeye_ai.demos.display import build_display, console, print_startup_banner, print_summary

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

_HUMAN_LABELS = {"person", "human", "man", "woman", "child", "pedestrian"}


# ---------------------------------------------------------------------------
# Setup helpers (keep run_demo readable)
# ---------------------------------------------------------------------------

def _open_camera(args: argparse.Namespace) -> tuple[Any, str]:
    """Return (camera_source, source_label) based on CLI args."""
    video_path: str | None = getattr(args, "video", None)

    if video_path:
        from openeye_ai.utils.camera import VideoPlayer

        try:
            cam = VideoPlayer(video_path)
            label = f"video: {Path(video_path).name}"
            logger.info("Using video file: %s (%d frames @ %.1f FPS)",
                        video_path, cam.frame_count, cam.fps)
            return cam, label
        except (FileNotFoundError, RuntimeError) as e:
            console.print(f"[red]Cannot open video file: {e}[/red]")
            sys.exit(1)

    if args.transport == "webcam":
        from openeye_ai.utils.camera import Camera

        try:
            cam = Camera(index=args.camera_index)
            logger.info("Using laptop webcam (dry-run mode)")
            return cam, f"webcam (index {args.camera_index})"
        except RuntimeError:
            console.print(
                "[red]Cannot open webcam.[/red]\n"
                "[yellow]Tip: Use --video <path> to use a pre-recorded video file instead.[/yellow]"
            )
            sys.exit(1)

    from openeye_ai.utils.unitree_camera import G1Camera, G1Transport

    transport_map = {
        "usb": G1Transport.USB,
        "rtsp": G1Transport.RTSP,
        "sdk": G1Transport.SDK,
        "auto": None,
    }
    cam = G1Camera(
        host=args.host,
        transport=transport_map.get(args.transport),
        device_index=args.camera_index,
        max_fps=args.max_fps,
    )
    logger.info("G1 camera connected via %s", cam.transport_name)
    return cam, f"G1 ({cam.transport_name})"


def _load_model(args: argparse.Namespace) -> tuple[Any, str]:
    """Load (and optionally warm-up) the detection model. Returns (adapter, model_name)."""
    from openeye_ai.config import MODELS_DIR
    from openeye_ai.registry import get_adapter, is_downloaded

    model_name = args.model
    if not is_downloaded(model_name):
        console.print(f"[red]Model '{model_name}' not downloaded.[/red]")
        console.print(f"[yellow]Run: openeye pull {model_name}[/yellow]")
        sys.exit(1)

    adapter = get_adapter(model_name)
    with console.status(f"[bold]Loading {model_name}...[/bold]"):
        adapter.load(MODELS_DIR / model_name)
    console.print(f"[green]Model loaded:[/green] [bold]{model_name}[/bold]")

    if getattr(args, "demo", False):
        with console.status("[bold]Warming up model (demo mode)...[/bold]"):
            import numpy as np
            from PIL import Image as PILImage
            dummy = PILImage.fromarray(
                np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
            )
            for _ in range(5):
                adapter.predict(dummy)
        console.print("[bold yellow]Demo mode:[/bold yellow] model is warm, zero cold-start")

    return adapter, model_name


def _detections_to_3d(result: dict, BBox2D, DetectedObject3D, Position3D) -> list:
    """Convert flat detection dicts into DetectedObject3D instances."""
    objects_3d = []
    for i, obj in enumerate(result.get("objects", [])):
        bbox = obj.get("bbox", {})
        bbox_h = bbox.get("h", 0.1)
        estimated_depth = max(0.3, 1.8 / max(bbox_h, 0.01))

        objects_3d.append(DetectedObject3D(
            track_id=f"obj_{i}",
            label=obj.get("label", "unknown"),
            confidence=obj.get("confidence", 0.0),
            bbox=BBox2D(
                x1=bbox.get("x", 0),
                y1=bbox.get("y", 0),
                x2=bbox.get("x", 0) + bbox.get("w", 0),
                y2=bbox.get("y", 0) + bbox.get("h", 0),
            ),
            position_3d=Position3D(
                x=(bbox.get("x", 0.5) + bbox.get("w", 0) / 2 - 0.5) * estimated_depth,
                y=0.0,
                z=estimated_depth,
            ),
        ))
    return objects_3d


# ---------------------------------------------------------------------------
# Main demo loop
# ---------------------------------------------------------------------------

def run_demo(args: argparse.Namespace) -> None:
    """Main demo loop."""
    from openeye_ai.connectors.unitree_g1 import G1Connector, G1ControlMode

    cam, source_label = _open_camera(args)

    control_mode = G1ControlMode(args.control_mode)
    connector = G1Connector(
        host=args.host,
        mode=control_mode,
        clear_duration=args.clear_duration,
    )
    logger.info("G1 connector: mode=%s, clear_duration=%.1fs", control_mode.value, args.clear_duration)

    adapter, model_name = _load_model(args)

    # Safety Guardian
    from openeye_ai._cli_helpers import ensure_backend_path
    ensure_backend_path()
    from perception.safety import SafetyGuardian
    from perception.models import BBox2D, DetectedObject3D, Position3D

    guardian = SafetyGuardian(danger_m=args.danger_m, caution_m=args.caution_m)

    # Signal handling
    shutdown = False

    def _signal_handler(sig, frame):
        nonlocal shutdown
        shutdown = True

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    print_startup_banner(
        model_name=model_name,
        control_mode=control_mode.value,
        danger_m=args.danger_m,
        caution_m=args.caution_m,
        clear_duration=args.clear_duration,
        source_label=source_label,
    )

    # Loop counters
    frame_count = 0
    fps_start = time.monotonic()
    fps_frames = 0
    current_fps = 0.0
    last_inference_ms = 0.0
    consecutive_cam_failures = 0
    consecutive_predict_failures = 0

    try:
        with Live(console=console, refresh_per_second=15, screen=True) as live:
            while not shutdown:
                frame = cam.read_pil()
                if frame is None:
                    consecutive_cam_failures += 1
                    if consecutive_cam_failures >= 300:
                        console.print(
                            f"[red]Camera returned {consecutive_cam_failures} "
                            f"consecutive empty frames -- check connection.[/red]"
                        )
                        connector.emergency_halt()
                        break
                    time.sleep(0.01)
                    continue
                consecutive_cam_failures = 0
                frame_count += 1
                fps_frames += 1

                try:
                    t0 = time.monotonic()
                    result = adapter.predict(frame)
                    last_inference_ms = (time.monotonic() - t0) * 1000
                    consecutive_predict_failures = 0
                except Exception as e:
                    consecutive_predict_failures += 1
                    logger.warning("Prediction failed (attempt %d): %s", consecutive_predict_failures, e)
                    if consecutive_predict_failures >= 10:
                        console.print("[red]Prediction failed 10 times consecutively -- halting.[/red]")
                        connector.emergency_halt()
                        break
                    continue

                objects_3d = _detections_to_3d(result, BBox2D, DetectedObject3D, Position3D)
                alerts, zones = guardian.evaluate(objects_3d)
                status = connector.process_safety_alerts(
                    [a.model_dump() for a in alerts],
                    [z.model_dump() for z in zones],
                )

                now = time.monotonic()
                if now - fps_start >= 1.0:
                    current_fps = fps_frames / (now - fps_start)
                    fps_start = now
                    fps_frames = 0
                else:
                    current_fps = fps_frames / max(now - fps_start, 0.001)

                n_humans = sum(1 for o in objects_3d if o.label.lower() in _HUMAN_LABELS)

                live.update(build_display(
                    frame_count=frame_count,
                    fps=current_fps,
                    inference_ms=last_inference_ms,
                    n_objects=len(result.get("objects", [])),
                    n_humans=n_humans,
                    zones=zones,
                    alerts=alerts,
                    status=status,
                    danger_m=args.danger_m,
                    caution_m=args.caution_m,
                    source_label=source_label,
                ))

    except Exception as e:
        logger.error("Demo loop error: %s", e)
        connector.emergency_halt()
        raise
    finally:
        connector.shutdown()
        cam.release()
        print_summary(frame_count, connector._halt_count, connector._resume_count)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="OpenEye Safety Guardian -- Unitree G1 Live Demo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run with webcam (no robot)
  python -m openeye_ai.demos.g1_safety_demo

  # With a pre-recorded video
  python -m openeye_ai.demos.g1_safety_demo --video demo.mp4

  # Real G1 over Wi-Fi
  python -m openeye_ai.demos.g1_safety_demo --host 192.168.123.161 --control-mode sdk --transport rtsp

  # Custom safety zones for tight demo space
  python -m openeye_ai.demos.g1_safety_demo --danger-m 0.8 --caution-m 2.0
        """,
    )

    # Camera
    parser.add_argument(
        "--transport",
        choices=["auto", "usb", "rtsp", "sdk", "webcam"],
        default="webcam",
        help="Camera transport (default: webcam for dry-run)",
    )
    parser.add_argument("--host", default="192.168.123.161", help="G1 IP address")
    parser.add_argument("--camera-index", type=int, default=0, help="USB camera device index")
    parser.add_argument("--max-fps", type=float, default=15.0, help="Max frame rate")

    # Video fallback
    parser.add_argument(
        "--video",
        type=str,
        default=None,
        help="Path to a video file to use instead of live camera (fallback for demos)",
    )

    # Robot control
    parser.add_argument(
        "--control-mode",
        choices=["sdk", "http", "dry_run"],
        default="dry_run",
        help="Robot control mode (default: dry_run)",
    )

    # Safety
    parser.add_argument("--danger-m", type=float, default=0.5, help="Danger zone threshold (metres)")
    parser.add_argument("--caution-m", type=float, default=1.5, help="Caution zone threshold (metres)")
    parser.add_argument("--clear-duration", type=float, default=2.0, help="Seconds clear before resume")

    # Model
    parser.add_argument("--model", default="yolov8", help="Detection model to use")

    # Demo mode
    parser.add_argument("--demo", action="store_true", help="Demo mode: warm up model before starting")

    args = parser.parse_args()
    run_demo(args)


if __name__ == "__main__":
    main()
