"""Watch command — live camera feed with real-time detections."""

from __future__ import annotations

import collections
import signal
import sys
import time
from pathlib import Path
from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console, dependency_error, warmup_adapter
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import get_adapter, get_model_info, is_downloaded


def watch(
    models: str = typer.Option("yolov8", "--models", "-m", help="Comma-separated model names"),
    camera: int = typer.Option(0, "--camera", "-c", help="Camera index"),
    video: Optional[str] = typer.Option(None, "--video", "-v", help="Video file path (fallback if camera fails)"),
    safety: bool = typer.Option(False, "--safety", "-s", help="Enable Safety Guardian overlay"),
    danger_m: float = typer.Option(0.5, "--danger-m", help="Danger zone threshold in metres (requires --safety)"),
    caution_m: float = typer.Option(1.5, "--caution-m", help="Caution zone threshold in metres (requires --safety)"),
    demo: bool = typer.Option(False, "--demo", help="Demo mode: warm up models for zero cold-start"),
) -> None:
    """Live camera feed with real-time detections displayed in terminal."""
    if camera < 0:
        rprint(f"[red]Invalid camera index {camera}. Must be >= 0.[/red]")
        raise typer.Exit(code=1)
    if safety and danger_m >= caution_m:
        rprint(f"[red]danger-m ({danger_m}) must be less than caution-m ({caution_m}).[/red]")
        raise typer.Exit(code=1)

    from rich.columns import Columns
    from rich.console import Group
    from rich.live import Live
    from rich.markup import escape as rich_escape
    from rich.panel import Panel
    from rich.text import Text

    from openeye_ai.utils.camera import Camera, VideoPlayer

    model_list = [m.strip() for m in models.split(",")]

    adapters = _load_adapters(model_list, demo)
    guardian, _DetectedObject3D, _BBox2D, _Position3D = _init_safety_guardian(safety, danger_m, caution_m)

    # Handle SIGTERM for graceful shutdown (e.g. systemd stop)
    def _sigterm_handler(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _sigterm_handler)

    cam, source_label = _open_input_source(camera, video)

    model_label = ", ".join(model_list)
    header = (
        f"[bold green]* LIVE[/bold green]  "
        f"Models: [bold cyan]{model_label}[/bold cyan]  "
        f"Source: [dim]{source_label}[/dim]  "
        f"Press [bold]Ctrl+C[/bold] to stop"
    )
    if safety:
        header += "  [bold red]Safety[/bold red]"
    if demo:
        header += "  [bold yellow]Demo[/bold yellow]"

    frame_times: collections.deque[float] = collections.deque(maxlen=60)
    dropped = 0
    frame_count = 0

    try:
        console.print(Panel(header, border_style="green"))
        with Live(console=console, refresh_per_second=12) as live:
            while True:
                loop_start = time.perf_counter()

                frame = cam.read_pil()
                if frame is None:
                    dropped += 1
                    if dropped > 30:
                        rprint("[red]Input source stopped responding. Exiting.[/red]")
                        break
                    time.sleep(0.1)
                    continue
                dropped = 0
                frame_count += 1

                all_rows, all_objects, total_inference_ms = _run_detections(adapters, frame, rich_escape)

                now = time.perf_counter()
                frame_times.append(now)
                if len(frame_times) >= 2:
                    elapsed = frame_times[-1] - frame_times[0]
                    fps = (len(frame_times) - 1) / elapsed if elapsed > 0 else 0.0
                else:
                    fps = 0.0

                if total_inference_ms < 50:
                    lat_color = "bold green"
                elif total_inference_ms < 100:
                    lat_color = "bold yellow"
                else:
                    lat_color = "bold red"

                stats = Text.assemble(
                    ("  FPS ", "dim"),
                    (f"{fps:.1f}", "bold cyan"),
                    ("  |  Latency ", "dim"),
                    (f"{total_inference_ms:.1f} ms", lat_color),
                    ("  |  Objects ", "dim"),
                    (f"{len(all_rows)}", "bold"),
                    ("  |  Frames ", "dim"),
                    (f"{frame_count}", "dim"),
                )

                table = Table(
                    show_header=True,
                    header_style="bold",
                    border_style="bright_black",
                    title_style="bold",
                    pad_edge=True,
                    expand=True,
                )
                table.add_column("Model", style="cyan", ratio=2)
                table.add_column("Detection", style="bold white", ratio=3)
                table.add_column("Conf", justify="right", ratio=1)
                table.add_column("Position", style="dim", ratio=2)
                table.add_column("ms", justify="right", style="dim", ratio=1)

                for row in all_rows:
                    table.add_row(*row)

                if not all_rows:
                    table.add_row("--", "[dim]No detections[/dim]", "", "", "")

                layout = Columns(
                    [Panel(table, title="[bold]Detections[/bold]", border_style="blue")],
                    expand=True,
                )

                display_parts: list = [stats, layout]

                if guardian is not None and _DetectedObject3D is not None:
                    safety_panel = _build_safety_panel(
                        guardian, all_objects, _DetectedObject3D, _BBox2D, _Position3D, Group,
                    )
                    display_parts.append(safety_panel)

                display = Group(*display_parts)
                live.update(
                    Panel(
                        display,
                        title="[bold]OpenEye Watch[/bold]",
                        subtitle=f"[dim]{model_label} | {source_label}[/dim]",
                        border_style="green",
                    )
                )

                elapsed_loop = time.perf_counter() - loop_start
                sleep_time = max(0, 0.05 - elapsed_loop)
                if sleep_time > 0:
                    time.sleep(sleep_time)

    except KeyboardInterrupt:
        pass
    finally:
        cam.release()
        console.print(
            Panel(
                f"[dim]Session ended. {frame_count} frames processed.[/dim]",
                border_style="dim",
            )
        )


# ── Helpers ───────────────────────────────────────────────────────────


def _load_adapters(model_list: list[str], demo: bool) -> dict:
    """Load and optionally warm up model adapters."""
    adapters = {}
    for m in model_list:
        try:
            info = get_model_info(m)
        except KeyError as e:
            rprint(f"[red]{e}[/red]")
            raise typer.Exit(code=1)
        model_dir = MODELS_DIR / m
        if not is_downloaded(m):
            rprint(f"[yellow]Model '{m}' not downloaded. Run: openeye pull {m}[/yellow]")
            raise typer.Exit(code=1)
        try:
            adapter = get_adapter(m)
        except ImportError as e:
            dependency_error(m, e)
        try:
            with console.status(f"[bold]Loading {info['name']}...[/bold]"):
                adapter.load(model_dir)
                adapters[m] = adapter
        except ImportError as e:
            dependency_error(m, e)
        except Exception as e:
            rprint(f"[red]Failed to load '{m}': {e}[/red]")
            raise typer.Exit(code=1)

    if demo:
        for m, adapter in adapters.items():
            try:
                with console.status(f"[bold]Warming up {m} (demo mode)...[/bold]"):
                    warmup_adapter(adapter, m)
            except Exception as e:
                rprint(f"[yellow]Warm-up failed for {m} ({e}), continuing anyway...[/yellow]")

    return adapters


def _init_safety_guardian(safety: bool, danger_m: float, caution_m: float):
    """Initialise the Safety Guardian if --safety is active.

    Returns (guardian, DetectedObject3D, BBox2D, Position3D) or all-None tuple.
    """
    if not safety:
        return None, None, None, None

    try:
        _repo_root = Path(__file__).resolve().parent
        for _ in range(6):
            if (_repo_root / "backend" / "src" / "perception").is_dir():
                break
            _repo_root = _repo_root.parent
        else:
            rprint("[red]Cannot find backend/src/perception -- run from the repo root[/red]")
            raise typer.Exit(code=1)
        sys.path.insert(0, str(_repo_root / "backend" / "src"))
        from perception.safety import SafetyGuardian
        from perception.models import BBox2D, DetectedObject3D, Position3D

        guardian = SafetyGuardian(danger_m=danger_m, caution_m=caution_m)
        rprint(f"[green]Safety Guardian enabled:[/green] danger < {danger_m}m, caution < {caution_m}m")
        return guardian, DetectedObject3D, BBox2D, Position3D
    except Exception as e:
        rprint(f"[yellow]Failed to load Safety Guardian: {e}[/yellow]")
        rprint("[yellow]Continuing without safety overlay.[/yellow]")
        return None, None, None, None


def _open_input_source(camera: int, video: Optional[str]):
    """Open camera or video source. Returns (source, label)."""
    from openeye_ai.utils.camera import Camera, VideoPlayer

    source_label = f"camera {camera}"
    cam = None

    if video:
        try:
            cam = VideoPlayer(video)
            source_label = f"video: {Path(video).name}"
            rprint(f"[green]Using video source:[/green] {video}")
        except (FileNotFoundError, RuntimeError) as e:
            rprint(f"[yellow]Cannot open video file ({e}), trying camera...[/yellow]")

    if cam is None:
        try:
            cam = Camera(camera)
        except ImportError:
            from openeye_ai._cli_helpers import _install_hint

            rprint(
                "[red]Missing opencv-python.[/red]\n"
                + _install_hint("camera")
            )
            if not video:
                raise typer.Exit(code=1)
        except RuntimeError as e:
            rprint(f"[yellow]Camera failed: {e}[/yellow]")
            if video:
                try:
                    cam = VideoPlayer(video)
                    source_label = f"video: {Path(video).name}"
                    rprint(f"[green]Falling back to video:[/green] {video}")
                except (FileNotFoundError, RuntimeError) as ve:
                    rprint(f"[red]Cannot open video file: {ve}[/red]")
                    raise typer.Exit(code=1)
            else:
                rprint("[yellow]Tip: Use --video <path> to use a pre-recorded video file.[/yellow]")
                raise typer.Exit(code=1)

    if cam is None:
        rprint("[red]No input source available.[/red]")
        raise typer.Exit(code=1)

    return cam, source_label


def _run_detections(adapters: dict, frame, rich_escape):
    """Run all adapters on a frame. Returns (rows, objects, total_ms)."""
    all_rows: list[tuple[str, str, str, str, str]] = []
    all_objects: list[dict] = []
    total_inference_ms = 0.0

    for m, adapter in adapters.items():
        result = adapter.predict(frame)
        inf_ms = result.get("inference_ms", 0.0)
        total_inference_ms += inf_ms
        for obj in result.get("objects", []):
            all_objects.append(obj)
            conf = obj["confidence"]
            if conf >= 0.7:
                conf_str = f"[bold green]{conf:.1%}[/bold green]"
            elif conf >= 0.4:
                conf_str = f"[yellow]{conf:.1%}[/yellow]"
            else:
                conf_str = f"[red]{conf:.1%}[/red]"
            all_rows.append((
                m,
                rich_escape(obj["label"]),
                conf_str,
                f"({obj['bbox']['x']:.2f}, {obj['bbox']['y']:.2f})",
                f"{inf_ms:.1f}",
            ))

    return all_rows, all_objects, total_inference_ms


def _build_safety_panel(guardian, all_objects, DetectedObject3D, BBox2D, Position3D, Group):
    """Build the Safety Guardian Rich panel."""
    from rich.panel import Panel
    from rich.text import Text

    human_labels = {"person", "human", "man", "woman", "child", "pedestrian"}
    objects_3d = []
    for i, obj in enumerate(all_objects):
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

    alerts, zones = guardian.evaluate(objects_3d)
    n_humans = sum(1 for o in objects_3d if o.label.lower() in human_labels)

    safety_table = Table(
        show_header=True,
        header_style="bold",
        border_style="bright_black",
        expand=True,
    )
    safety_table.add_column("Zone", justify="center", width=10)
    safety_table.add_column("Track", style="cyan")
    safety_table.add_column("Distance", justify="right")
    safety_table.add_column("Alert", style="bold")

    if zones:
        for z in zones:
            zone_val = z.zone.value
            if zone_val == "danger":
                zone_str = "[bold white on red] DANGER [/bold white on red]"
            elif zone_val == "caution":
                zone_str = "[bold black on yellow] CAUTION [/bold black on yellow]"
            else:
                zone_str = "[bold white on green]  SAFE  [/bold white on green]"
            safety_table.add_row(
                zone_str,
                z.human_track_id,
                f"{z.distance_m:.2f}m",
                f"{z.bearing_deg:.0f} deg",
            )
    else:
        safety_table.add_row(
            "[bold white on green]  SAFE  [/bold white on green]",
            "[dim]--[/dim]",
            "[dim]--[/dim]",
            f"[dim]{n_humans} humans tracked[/dim]",
        )

    alert_text = Text()
    if alerts:
        for a in alerts:
            style = "bold red" if a.halt_recommended else "yellow"
            alert_text.append(f"  {a.message}\n", style=style)
    else:
        alert_text.append("  Workspace clear", style="dim green")

    return Panel(
        Group(safety_table, alert_text),
        title="[bold]Safety Guardian[/bold]",
        border_style="red" if alerts else "green",
    )
