"""Helper functions for the watch command."""

from __future__ import annotations

import time
from pathlib import Path

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console, dependency_error, warmup_adapter
from openeye_ai.config import MODELS_DIR, OPENEYE_HOME
from openeye_ai.registry import get_adapter, get_model_info, is_downloaded


def load_adapters(model_list: list[str], demo: bool) -> dict:
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


def init_safety_guardian(safety: bool, danger_m: float, caution_m: float):
    """Initialise the Safety Guardian if --safety is active.

    Returns (guardian, DetectedObject3D, BBox2D, Position3D) or all-None tuple.
    """
    if not safety:
        return None, None, None, None

    try:
        from openeye_ai._cli_helpers import ensure_backend_path
        ensure_backend_path()
        from perception.safety import SafetyGuardian
        from perception.models import BBox2D, DetectedObject3D, Position3D

        guardian = SafetyGuardian(danger_m=danger_m, caution_m=caution_m)
        rprint(f"[green]Safety Guardian enabled:[/green] danger < {danger_m}m, caution < {caution_m}m")
        return guardian, DetectedObject3D, BBox2D, Position3D
    except Exception as e:
        rprint(f"[yellow]Failed to load Safety Guardian: {e}[/yellow]")
        rprint("[yellow]Continuing without safety overlay.[/yellow]")
        return None, None, None, None


def find_demo_video() -> Path | None:
    """Search for a demo video in standard locations."""
    candidates = [
        OPENEYE_HOME / "demo.mp4",
        Path(__file__).resolve().parent.parent / "demos" / "demo.mp4",
    ]
    for p in candidates:
        if p.is_file():
            return p
    return None


def open_input_source(camera: int, video: str | None):
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
                demo_path = find_demo_video()
                if demo_path:
                    try:
                        cam = VideoPlayer(str(demo_path))
                        source_label = f"demo: {demo_path.name}"
                        rprint(f"[green]Falling back to demo video:[/green] {demo_path}")
                    except (FileNotFoundError, RuntimeError) as de:
                        rprint(f"[red]Cannot open demo video: {de}[/red]")
                        raise typer.Exit(code=1)
                else:
                    rprint("[yellow]Tip: Place a demo.mp4 in ~/.openeye/ or use --video <path>[/yellow]")
                    raise typer.Exit(code=1)

    if cam is None:
        rprint("[red]No input source available.[/red]")
        raise typer.Exit(code=1)

    return cam, source_label


def run_detections(adapters: dict, frame, rich_escape):
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


def build_safety_panel(guardian, all_objects, DetectedObject3D, BBox2D, Position3D, Group):
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

    n_danger = sum(1 for z in zones if z.zone.value == "danger")
    n_caution = sum(1 for z in zones if z.zone.value == "caution")

    panel = Panel(
        Group(safety_table, alert_text),
        title="[bold]Safety Guardian[/bold]",
        border_style="red" if alerts else "green",
    )
    return panel, n_danger, n_caution


def print_session_summary(
    *,
    frame_count: int,
    session_start: float,
    latency_samples: list[float],
    total_detections: int,
    safety: bool,
    safety_danger_count: int,
    safety_caution_count: int,
) -> None:
    """Print a Rich table summarising the watch session."""
    from rich.panel import Panel

    runtime = time.perf_counter() - session_start
    avg_fps = frame_count / runtime if runtime > 0 else 0.0
    avg_latency = (
        sum(latency_samples) / len(latency_samples) if latency_samples else 0.0
    )

    table = Table(
        show_header=False,
        border_style="dim",
        pad_edge=True,
        expand=False,
    )
    table.add_column("Metric", style="dim")
    table.add_column("Value", style="bold")

    table.add_row("Total frames", str(frame_count))
    table.add_row("Runtime", f"{runtime:.1f}s")
    table.add_row("Avg FPS", f"{avg_fps:.1f}")
    table.add_row("Avg latency", f"{avg_latency:.1f} ms")
    table.add_row("Total detections", str(total_detections))

    if safety:
        table.add_row("Danger events", str(safety_danger_count))
        table.add_row("Caution events", str(safety_caution_count))

    console.print(
        Panel(
            table,
            title="[bold]Session Summary[/bold]",
            border_style="dim",
        )
    )
