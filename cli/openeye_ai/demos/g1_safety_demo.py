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
from typing import Optional

from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

console = Console()


# ---------------------------------------------------------------------------
# Visual helpers
# ---------------------------------------------------------------------------

def _zone_badge(zone: str) -> Text:
    """Return a Rich Text badge for a safety zone level."""
    if zone == "danger":
        return Text(" DANGER ", style="bold white on red")
    elif zone == "caution":
        return Text(" CAUTION ", style="bold black on yellow")
    return Text("  SAFE  ", style="bold white on green")


def _state_badge(state: str) -> Text:
    """Return a Rich Text badge for robot state."""
    if state == "halted":
        return Text(" HALTED ", style="bold white on red")
    elif state == "resuming":
        return Text(" RESUMING ", style="bold black on yellow")
    return Text(" MOVING ", style="bold white on green")


def _latency_bar(ms: float, width: int = 20) -> Text:
    """Build a visual latency bar. Green <30ms, yellow <80ms, red above."""
    # Clamp to a reasonable max for display
    max_ms = 150.0
    ratio = min(ms / max_ms, 1.0)
    filled = int(ratio * width)
    empty = width - filled

    if ms < 30:
        bar_style = "bold green"
        label_style = "bold green"
    elif ms < 80:
        bar_style = "bold yellow"
        label_style = "bold yellow"
    else:
        bar_style = "bold red"
        label_style = "bold red"

    bar = Text()
    bar.append("".join(["#" for _ in range(filled)]), style=bar_style)
    bar.append("".join(["-" for _ in range(empty)]), style="dim")
    bar.append(f" {ms:>6.1f}ms", style=label_style)
    return bar


def _safety_shield(danger_m: float, caution_m: float, zones: list, state: str) -> Panel:
    """Build an ASCII safety zone diagram showing concentric zones around robot."""
    # Determine current worst zone
    worst = "safe"
    for z in zones:
        zval = z.zone.value if hasattr(z, "zone") else str(z.get("zone", "safe"))
        if zval == "danger":
            worst = "danger"
            break
        elif zval == "caution":
            worst = "caution"

    # Build the concentric zone diagram
    lines = []

    if worst == "danger":
        border_style = "bold red"
        shield_icon = "!!!"
    elif worst == "caution":
        border_style = "bold yellow"
        shield_icon = " ! "
    else:
        border_style = "bold green"
        shield_icon = " * "

    # Top-down concentric zone visualization
    w = 33  # total width of the diagram area
    lines.append(Text("        SAFETY ZONE MAP", style="bold"))
    lines.append(Text())

    # Outer ring: SAFE zone
    safe_style = "on green" if worst == "safe" else "dim green"
    caution_style = "on yellow" if worst == "caution" else "dim yellow"
    danger_style = "on red" if worst == "danger" else "dim red"

    # Row 1-2: Safe outer
    row = Text()
    row.append("  ")
    row.append("." * w, style=safe_style)
    lines.append(row)

    # Row 3: Safe with caution inside
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * (w - 10), style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Row 4: All three zones
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * 4, style=caution_style)
    row.append("X" * (w - 18), style=danger_style)
    row.append("~" * 4, style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Row 5: Robot center
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * 4, style=caution_style)
    row.append("X" * 4, style=danger_style)
    robot_label = f"[{shield_icon}]"
    row.append(robot_label, style="bold white on blue")
    padding = w - 18 - len(robot_label)
    row.append("X" * max(0, padding), style=danger_style)
    row.append("~" * 4, style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Row 6: mirror of row 4
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * 4, style=caution_style)
    row.append("X" * (w - 18), style=danger_style)
    row.append("~" * 4, style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Row 7: caution fading to safe
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * (w - 10), style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Row 8: safe outer
    row = Text()
    row.append("  ")
    row.append("." * w, style=safe_style)
    lines.append(row)

    lines.append(Text())

    # Legend
    legend = Text()
    legend.append("  . ", style="green")
    legend.append(f"Safe (>{caution_m}m)  ", style="dim")
    legend.append("~ ", style="yellow")
    legend.append(f"Caution (<{caution_m}m)  ", style="dim")
    legend.append("X ", style="red")
    legend.append(f"Danger (<{danger_m}m)", style="dim")
    lines.append(legend)

    content = Group(*lines)
    return Panel(
        content,
        title="[bold]Safety Shield[/bold]",
        border_style=border_style,
        width=42,
    )


def _build_display(
    frame_count: int,
    fps: float,
    inference_ms: float,
    n_objects: int,
    n_humans: int,
    zones: list,
    alerts: list,
    status: dict,
    danger_m: float,
    caution_m: float,
    source_label: str,
) -> Panel:
    """Build the full Rich display for one frame."""
    # --- Header stats ---
    stats = Table(show_header=False, box=None, pad_edge=False, expand=True)
    stats.add_column("key", style="dim", ratio=1)
    stats.add_column("val", ratio=2)

    stats.add_row("Frame", f"[bold]{frame_count}[/bold]")
    fps_style = "bold green" if fps >= 10 else ("bold yellow" if fps >= 5 else "bold red")
    stats.add_row("FPS", Text(f"{fps:.1f}", style=fps_style))
    stats.add_row("Objects", f"[bold]{n_objects}[/bold]")
    stats.add_row("Humans", f"[bold cyan]{n_humans}[/bold cyan]")
    stats.add_row("Source", f"[dim]{source_label}[/dim]")

    stats_panel = Panel(stats, title="[bold]Stats[/bold]", border_style="cyan", width=28)

    # --- Latency meter ---
    latency_content = Group(
        Text("  Inference Latency", style="bold"),
        Text(),
        Text("  ").append_text(_latency_bar(inference_ms, width=22)),
        Text(),
        Text(f"  Target: < 30ms", style="dim"),
    )
    latency_panel = Panel(latency_content, title="[bold]Latency[/bold]", border_style="cyan", width=38)

    # --- Safety Shield ---
    shield_panel = _safety_shield(danger_m, caution_m, zones, status["state"])

    # --- Zone Table ---
    zone_table = Table(
        show_header=True,
        header_style="bold",
        border_style="bright_black",
        expand=True,
        title="Active Zones",
        title_style="bold",
    )
    zone_table.add_column("Zone", justify="center", width=10)
    zone_table.add_column("Track ID", style="cyan")
    zone_table.add_column("Distance", justify="right")
    zone_table.add_column("Bearing", justify="right")

    if zones:
        for z in zones:
            zone_val = z.zone.value if hasattr(z, "zone") else str(z.get("zone", "safe"))
            track_id = z.human_track_id if hasattr(z, "human_track_id") else z.get("human_track_id", "?")
            distance = z.distance_m if hasattr(z, "distance_m") else z.get("distance_m", 0)
            bearing = z.bearing_deg if hasattr(z, "bearing_deg") else z.get("bearing_deg", 0)

            badge = _zone_badge(zone_val)
            zone_table.add_row(
                badge,
                str(track_id),
                f"{distance:.2f}m",
                f"{bearing:.0f} deg",
            )
    else:
        zone_table.add_row(
            _zone_badge("safe"),
            "[dim]--[/dim]",
            "[dim]--[/dim]",
            "[dim]--[/dim]",
        )

    # --- Alerts ---
    alert_lines: list[Text] = []
    if alerts:
        for a in alerts:
            halt = a.halt_recommended if hasattr(a, "halt_recommended") else a.get("halt_recommended", False)
            msg = a.message if hasattr(a, "message") else a.get("message", "")
            style = "bold red" if halt else "yellow"
            alert_lines.append(Text(f"  {msg}", style=style))
    else:
        alert_lines.append(Text("  No active alerts", style="dim green"))

    alerts_panel = Panel(
        Group(*alert_lines),
        title="[bold]Alerts[/bold]",
        border_style="red" if alerts else "green",
    )

    # --- Robot status bar ---
    state_badge = _state_badge(status["state"])
    action_text = Text(f"  Action: ", style="dim")
    action_text.append(status["action"].upper(), style="bold")

    robot_stats = Text()
    robot_stats.append(f"  Halts: ", style="dim")
    robot_stats.append(f"{status['halt_count']}", style="bold red")
    robot_stats.append(f"  Resumes: ", style="dim")
    robot_stats.append(f"{status['resume_count']}", style="bold green")

    details_text = Text()
    if status.get("details"):
        details_text.append(f"  {status['details']}", style="dim")

    robot_content = Group(
        Text.assemble(("  Robot: ", "dim"), state_badge),
        action_text,
        robot_stats,
        details_text,
    )
    robot_panel = Panel(
        robot_content,
        title="[bold]Robot Control[/bold]",
        border_style="red" if status["state"] == "halted" else "green",
    )

    # --- Compose the full layout ---
    # Top row: stats + latency side by side (simulated with Group)
    top_row = Table(show_header=False, box=None, pad_edge=False, expand=True)
    top_row.add_column(ratio=3)
    top_row.add_column(ratio=4)
    top_row.add_column(ratio=4)
    top_row.add_row(stats_panel, latency_panel, shield_panel)

    footer = Text("  Press Ctrl+C to stop", style="dim")

    full_display = Group(
        top_row,
        zone_table,
        alerts_panel,
        robot_panel,
        footer,
    )

    return Panel(
        full_display,
        title="[bold cyan]OpenEye Safety Guardian -- Unitree G1 Demo[/bold cyan]",
        subtitle="[dim]openeye g1-demo[/dim]",
        border_style="cyan",
    )


# ---------------------------------------------------------------------------
# Startup banner
# ---------------------------------------------------------------------------

def _print_startup_banner(
    model_name: str,
    control_mode: str,
    danger_m: float,
    caution_m: float,
    clear_duration: float,
    source_label: str,
) -> None:
    """Print a polished startup banner before entering the live loop."""
    banner_lines = [
        f"[bold green]*[/bold green] Model:       [bold]{model_name}[/bold]",
        f"[bold green]*[/bold green] Control:     [bold]{control_mode}[/bold]",
        f"[bold green]*[/bold green] Source:      [bold]{source_label}[/bold]",
        f"[bold green]*[/bold green] Danger zone: [bold red]< {danger_m}m[/bold red]",
        f"[bold green]*[/bold green] Caution:     [bold yellow]< {caution_m}m[/bold yellow]",
        f"[bold green]*[/bold green] Clear time:  [bold]{clear_duration}s[/bold] before resume",
    ]
    console.print(Panel(
        "\n".join(banner_lines),
        title="[bold cyan]OpenEye Safety Guardian[/bold cyan]",
        subtitle="[dim]Unitree G1 Demo[/dim]",
        border_style="cyan",
    ))


# ---------------------------------------------------------------------------
# Main demo loop
# ---------------------------------------------------------------------------

def run_demo(args: argparse.Namespace) -> None:
    """Main demo loop."""
    # Lazy imports to give fast --help
    from openeye_ai.connectors.unitree_g1 import (
        G1Connector,
        G1ControlMode,
    )

    # ------------------------------------------------------------------
    # Camera / video source
    # ------------------------------------------------------------------
    video_path: Optional[str] = getattr(args, "video", None)
    source_label = "webcam"

    if video_path:
        # Use video file as source
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
            # Fallback: check if --video was not provided, suggest it
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

    # ------------------------------------------------------------------
    # Robot connector
    # ------------------------------------------------------------------
    control_mode = G1ControlMode(args.control_mode)
    connector = G1Connector(
        host=args.host,
        mode=control_mode,
        clear_duration=args.clear_duration,
    )
    logger.info("G1 connector: mode=%s, clear_duration=%.1fs", control_mode.value, args.clear_duration)

    # ------------------------------------------------------------------
    # Perception model
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # Safety Guardian
    # ------------------------------------------------------------------
    _demo_file = Path(__file__).resolve()
    _repo_root = _demo_file.parent
    for _ in range(6):
        if (_repo_root / "backend" / "src" / "perception").is_dir():
            break
        _repo_root = _repo_root.parent
    else:
        console.print("[red]Cannot find backend/src/perception -- run from the repo root[/red]")
        sys.exit(1)
    sys.path.insert(0, str(_repo_root / "backend" / "src"))
    from perception.safety import SafetyGuardian
    from perception.models import (
        BBox2D,
        DetectedObject3D,
        Position3D,
        ZoneLevel,
    )

    guardian = SafetyGuardian(
        danger_m=args.danger_m,
        caution_m=args.caution_m,
    )

    # ------------------------------------------------------------------
    # Signal handling for clean shutdown
    # ------------------------------------------------------------------
    shutdown = False

    def _signal_handler(sig, frame):
        nonlocal shutdown
        shutdown = True

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    # ------------------------------------------------------------------
    # Print startup banner
    # ------------------------------------------------------------------
    _print_startup_banner(
        model_name=model_name,
        control_mode=control_mode.value,
        danger_m=args.danger_m,
        caution_m=args.caution_m,
        clear_duration=args.clear_duration,
        source_label=source_label,
    )

    # ------------------------------------------------------------------
    # Demo loop
    # ------------------------------------------------------------------
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
                human_labels = {"person", "human", "man", "woman", "child", "pedestrian"}
                humans = [o for o in objects_3d if o.label.lower() in human_labels]
                n_objects = len(result.get("objects", []))
                n_humans = len(humans)

                # Build and update display
                display = _build_display(
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
        # Shutdown summary
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
