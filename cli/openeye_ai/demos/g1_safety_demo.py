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

import logging
import signal
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import typer
from rich.live import Live
from rich.panel import Panel
from rich.table import Table

from openeye_ai._backend import ensure_backend_path
from openeye_ai.constants import HUMAN_LABELS, estimate_depth_from_bbox_height
from openeye_ai.demos.display import build_display, console, print_startup_banner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


@dataclass
class DemoArgs:
    """Typed container for Safety Guardian demo parameters."""

    transport: str = "webcam"
    host: str = "192.168.123.161"
    camera_index: int = 0
    max_fps: float = 15.0
    video: str | None = None
    control_mode: str = "dry_run"
    danger_m: float = 0.5
    caution_m: float = 1.5
    clear_duration: float = 2.0
    model: str = "yolov8"
    demo: bool = False


# ---------------------------------------------------------------------------
# Camera source setup
# ---------------------------------------------------------------------------

def _setup_camera(args: DemoArgs) -> tuple:
    """Set up the camera/video source. Returns (cam, source_label)."""
    video_path = args.video

    if video_path:
        from openeye_ai.utils.camera import VideoPlayer

        try:
            cam = VideoPlayer(video_path)
            source_label = f"video: {Path(video_path).name}"
            logger.info("Using video file: %s (%d frames @ %.1f FPS)",
                        video_path, cam.frame_count, cam.fps)
        except (FileNotFoundError, RuntimeError) as e:
            console.print(f"[red]Cannot open video file: {e}[/red]")
            sys.exit(1)
    elif args.transport == "webcam":
        from openeye_ai.utils.camera import Camera

        try:
            cam = Camera(index=args.camera_index)
            source_label = f"webcam (index {args.camera_index})"
            logger.info("Using laptop webcam (dry-run mode)")
        except RuntimeError:
            console.print(
                "[red]Cannot open webcam.[/red]\n"
                "[yellow]Tip: Use --video <path> to use a pre-recorded video file instead.[/yellow]"
            )
            sys.exit(1)
    else:
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
        source_label = f"G1 ({cam.transport_name})"
        logger.info("G1 camera connected via %s", cam.transport_name)

    return cam, source_label


# ---------------------------------------------------------------------------
# Main demo loop
# ---------------------------------------------------------------------------

def run_demo(args: DemoArgs) -> None:
    """Main demo loop."""
    from openeye_ai.connectors.unitree_g1 import (
        G1Connector,
        G1ControlMode,
    )

    # Camera / video source
    cam, source_label = _setup_camera(args)

    # Robot connector
    control_mode = G1ControlMode(args.control_mode)
    connector = G1Connector(
        host=args.host,
        mode=control_mode,
        clear_duration=args.clear_duration,
    )
    logger.info("G1 connector: mode=%s, clear_duration=%.1fs", control_mode.value, args.clear_duration)

    # Perception model
    from openeye_ai.config import MODELS_DIR
    from openeye_ai.registry import get_adapter, is_downloaded

    model_name = args.model
    if not is_downloaded(model_name):
        console.print(f"[red]Model '{model_name}' not downloaded.[/red]")
        console.print(f"[yellow]Run: openeye pull {model_name}[/yellow]")
        sys.exit(1)

    adapter = get_adapter(model_name)
    model_dir = MODELS_DIR / model_name

    with console.status(f"[bold]Loading {model_name}...[/bold]"):
        adapter.load(model_dir)
    console.print(f"[green]Model loaded:[/green] [bold]{model_name}[/bold]")

    # Optional warm-up in demo mode
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

    # Safety Guardian
    ensure_backend_path()
    from perception.safety import SafetyGuardian
    from perception.models import (
        BBox2D,
        DetectedObject3D,
        Position3D,
    )

    guardian = SafetyGuardian(
        danger_m=args.danger_m,
        caution_m=args.caution_m,
    )

    # Signal handling for clean shutdown
    shutdown = False

    def _signal_handler(sig, frame):
        nonlocal shutdown
        shutdown = True

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    # Print startup banner
    print_startup_banner(
        model_name=model_name,
        control_mode=control_mode.value,
        danger_m=args.danger_m,
        caution_m=args.caution_m,
        clear_duration=args.clear_duration,
        source_label=source_label,
    )

    # Demo loop
    frame_count = 0
    fps_start = time.monotonic()
    fps_frames = 0
    current_fps = 0.0
    last_inference_ms = 0.0
    consecutive_cam_failures = 0
    max_cam_failures = 300
    consecutive_predict_failures = 0
    max_predict_failures = 10

    try:
        with Live(console=console, refresh_per_second=15, screen=True) as live:
            while not shutdown:
                frame = cam.read_pil()
                if frame is None:
                    consecutive_cam_failures += 1
                    if consecutive_cam_failures >= max_cam_failures:
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

                # Run detection
                try:
                    t0 = time.monotonic()
                    result = adapter.predict(frame)
                    last_inference_ms = (time.monotonic() - t0) * 1000
                    consecutive_predict_failures = 0
                except Exception as e:
                    consecutive_predict_failures += 1
                    logger.warning("Prediction failed (attempt %d): %s", consecutive_predict_failures, e)
                    if consecutive_predict_failures >= max_predict_failures:
                        console.print(
                            f"[red]Prediction failed {max_predict_failures} "
                            f"times consecutively -- halting.[/red]"
                        )
                        connector.emergency_halt()
                        break
                    continue

                # Convert detections to DetectedObject3D for Safety Guardian
                objects_3d = []
                for i, obj in enumerate(result.get("objects", [])):
                    bbox = obj.get("bbox", {})
                    bbox_h = bbox.get("h", 0.1)
                    estimated_depth = estimate_depth_from_bbox_height(bbox_h)

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

                # Run Safety Guardian
                alerts, zones = guardian.evaluate(objects_3d)

                # Send to robot connector
                alert_dicts = [a.model_dump() for a in alerts]
                zone_dicts = [z.model_dump() for z in zones]
                status = connector.process_safety_alerts(alert_dicts, zone_dicts)

                # Calculate FPS
                now = time.monotonic()
                if now - fps_start >= 1.0:
                    current_fps = fps_frames / (now - fps_start)
                    fps_start = now
                    fps_frames = 0
                else:
                    current_fps = fps_frames / max(now - fps_start, 0.001)

                # Count humans
                humans = [o for o in objects_3d if o.label.lower() in HUMAN_LABELS]
                n_objects = len(result.get("objects", []))
                n_humans = len(humans)

                # Build and update display
                display = build_display(
                    frame_count=frame_count,
                    fps=current_fps,
                    inference_ms=last_inference_ms,
                    n_objects=n_objects,
                    n_humans=n_humans,
                    zones=zones,
                    alerts=alerts,
                    status=status,
                    danger_m=args.danger_m,
                    caution_m=args.caution_m,
                    source_label=source_label,
                )
                live.update(display)

    except Exception as e:
        logger.error("Demo loop error: %s", e)
        connector.emergency_halt()
        raise
    finally:
        connector.shutdown()
        cam.release()

        summary_table = Table(show_header=False, box=None)
        summary_table.add_column("key", style="dim")
        summary_table.add_column("val", style="bold")
        summary_table.add_row("Total frames", str(frame_count))
        summary_table.add_row("Halts issued", str(connector._halt_count))
        summary_table.add_row("Resumes issued", str(connector._resume_count))

        console.print()
        console.print(Panel(
            summary_table,
            title="[bold]Demo Complete[/bold]",
            border_style="cyan",
        ))


def main(
    transport: str = typer.Option("webcam", help="Camera: auto, usb, rtsp, sdk, webcam"),
    host: str = typer.Option("192.168.123.161", help="G1 IP address"),
    camera_index: int = typer.Option(0, "--camera-index", help="USB camera device index"),
    max_fps: float = typer.Option(15.0, "--max-fps", help="Max frame rate"),
    video: str | None = typer.Option(None, "--video", "-v", help="Video file path (fallback for demos)"),
    control_mode: str = typer.Option("dry_run", "--control-mode", help="Robot control: sdk, http, dry_run"),
    danger_m: float = typer.Option(0.5, "--danger-m", help="Danger zone threshold (metres)"),
    caution_m: float = typer.Option(1.5, "--caution-m", help="Caution zone threshold (metres)"),
    clear_duration: float = typer.Option(2.0, "--clear-duration", help="Seconds clear before resume"),
    model: str = typer.Option("yolov8", "--model", "-m", help="Detection model to use"),
    demo: bool = typer.Option(False, "--demo", help="Demo mode: warm up model before starting"),
) -> None:
    """OpenEye Safety Guardian -- Unitree G1 Live Demo.

    Wires: G1 Camera -> OpenEye Detection -> Safety Guardian -> G1 Halt Signal.
    Use --transport webcam (default) for dry-run with laptop camera.
    """
    args = DemoArgs(
        transport=transport,
        host=host,
        camera_index=camera_index,
        max_fps=max_fps,
        video=video,
        control_mode=control_mode,
        danger_m=danger_m,
        caution_m=caution_m,
        clear_duration=clear_duration,
        model=model,
        demo=demo,
    )
    run_demo(args)


if __name__ == "__main__":
    typer.run(main)
