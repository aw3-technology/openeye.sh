"""``openeye watch`` — live camera feed with real-time detections."""

from __future__ import annotations

import collections
import signal
import time
from pathlib import Path

import typer
from rich import print as rprint
from rich.columns import Columns
from rich.console import Group
from rich.live import Live
from rich.markup import escape as rich_escape
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from openeye_ai._backend import ensure_backend_path
from openeye_ai._cli_helpers import console, dependency_error, warmup_adapter
from openeye_ai.commands.inference._helpers import resolve_model_dir, resolve_model_info
from openeye_ai.config import MODELS_DIR
from openeye_ai.constants import HUMAN_LABELS, estimate_depth_from_bbox_height
from openeye_ai.registry import get_adapter, get_model_info, is_downloaded

def watch(
    models: str = typer.Option("yolov8", "--models", "-m", help="Comma-separated model names"),
    camera: int = typer.Option(0, "--camera", "-c", help="Camera index"),
    video: str | None = typer.Option(None, "--video", "-v", help="Video file path (fallback if camera fails)"),
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

    adapters = _load_models([m.strip() for m in models.split(",")], demo=demo)
    guardian, guardian_types = _init_safety_guardian(safety, danger_m, caution_m)
    cam, source_label = _open_input_source(camera, video)

    _sigterm_received = False

    def _sigterm_handler(signum, frame):
        nonlocal _sigterm_received
        _sigterm_received = True
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _sigterm_handler)

    model_list = list(adapters.keys())
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

                all_rows, all_objects, total_inference_ms = _run_inference(adapters, frame)

                now = time.perf_counter()
                frame_times.append(now)
                fps = _compute_fps(frame_times)

                display_parts: list = [
                    _build_stats_bar(fps, total_inference_ms, len(all_rows), frame_count),
                    _build_detections_table(all_rows),
                ]

                if guardian is not None:
                    safety_panel = _build_safety_panel(guardian, guardian_types, all_objects)
                    if safety_panel is not None:
                        display_parts.append(safety_panel)

                live.update(
                    Panel(
                        Group(*display_parts),
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

# ── Private helpers ──────────────────────────────────────────────────

def _load_models(model_list: list[str], *, demo: bool) -> dict:
    """Load adapters for each model name."""
    adapters = {}
    for m in model_list:
        info = resolve_model_info(m)
        model_dir = resolve_model_dir(m)
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
    """Initialise the Safety Guardian if requested. Returns (guardian, types_dict)."""
    if not safety:
        return None, {}

    try:
        ensure_backend_path()
        from perception.safety import SafetyGuardian
        from perception.models import BBox2D, DetectedObject3D, Position3D
        guardian = SafetyGuardian(danger_m=danger_m, caution_m=caution_m)
        rprint(f"[green]Safety Guardian enabled:[/green] danger < {danger_m}m, caution < {caution_m}m")
        return guardian, {"BBox2D": BBox2D, "DetectedObject3D": DetectedObject3D, "Position3D": Position3D}
    except Exception as e:
        rprint(f"[yellow]Failed to load Safety Guardian: {e}[/yellow]")
        rprint("[yellow]Continuing without safety overlay.[/yellow]")
        return None, {}

def _open_input_source(camera: int, video: str | None):
    """Open camera or video, return (source, label)."""
    from openeye_ai.utils.camera import Camera, VideoPlayer

    cam = None
    source_label = f"camera {camera}"

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
            rprint(
                "[red]Missing opencv-python.[/red]\n"
                "Install with: [bold]pip install openeye-ai\\[camera][/bold]"
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

def _run_inference(adapters: dict, frame) -> tuple[list, list, float]:
    """Run all adapters on a frame. Returns (rows, objects, total_ms)."""
    all_rows: list[tuple[str, str, str, str, str]] = []
    all_objects: list[dict] = []
    total_ms = 0.0

    for m, adapter in adapters.items():
        result = adapter.predict(frame)
        inf_ms = result.get("inference_ms", 0.0)
        total_ms += inf_ms
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

    return all_rows, all_objects, total_ms

def _compute_fps(frame_times: collections.deque) -> float:
    if len(frame_times) >= 2:
        elapsed = frame_times[-1] - frame_times[0]
        return (len(frame_times) - 1) / elapsed if elapsed > 0 else 0.0
    return 0.0

def _build_stats_bar(fps: float, latency_ms: float, n_objects: int, frame_count: int) -> Text:
    if latency_ms < 50:
        lat_color = "bold green"
    elif latency_ms < 100:
        lat_color = "bold yellow"
    else:
        lat_color = "bold red"

    return Text.assemble(
        ("  FPS ", "dim"),
        (f"{fps:.1f}", "bold cyan"),
        ("  |  Latency ", "dim"),
        (f"{latency_ms:.1f} ms", lat_color),
        ("  |  Objects ", "dim"),
        (f"{n_objects}", "bold"),
        ("  |  Frames ", "dim"),
        (f"{frame_count}", "dim"),
    )

def _build_detections_table(rows: list[tuple]) -> Columns:
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

    for row in rows:
        table.add_row(*row)

    if not rows:
        table.add_row("--", "[dim]No detections[/dim]", "", "", "")

    return Columns(
        [Panel(table, title="[bold]Detections[/bold]", border_style="blue")],
        expand=True,
    )

def _build_safety_panel(guardian, types: dict, all_objects: list[dict]) -> Panel | None:
    _DetectedObject3D = types.get("DetectedObject3D")
    _BBox2D = types.get("BBox2D")
    _Position3D = types.get("Position3D")
    if _DetectedObject3D is None:
        return None

    objects_3d = []
    for i, obj in enumerate(all_objects):
        bbox = obj.get("bbox", {})
        bbox_h = bbox.get("h", 0.1)
        estimated_depth = estimate_depth_from_bbox_height(bbox_h)
        objects_3d.append(_DetectedObject3D(
            track_id=f"obj_{i}",
            label=obj.get("label", "unknown"),
            confidence=obj.get("confidence", 0.0),
            bbox=_BBox2D(
                x1=bbox.get("x", 0),
                y1=bbox.get("y", 0),
                x2=bbox.get("x", 0) + bbox.get("w", 0),
                y2=bbox.get("y", 0) + bbox.get("h", 0),
            ),
            position_3d=_Position3D(
                x=(bbox.get("x", 0.5) + bbox.get("w", 0) / 2 - 0.5) * estimated_depth,
                y=0.0,
                z=estimated_depth,
            ),
        ))

    alerts, zones = guardian.evaluate(objects_3d)
    n_humans = sum(1 for o in objects_3d if o.label.lower() in HUMAN_LABELS)

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
