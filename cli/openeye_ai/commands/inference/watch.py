"""Watch command — live camera feed with real-time detections."""

from __future__ import annotations

import collections
import signal
import time

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console
from openeye_ai.commands.inference.watch_helpers import (
    build_safety_panel,
    init_safety_guardian,
    load_adapters,
    open_input_source,
    print_session_summary,
    run_detections,
)


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

    from rich.columns import Columns
    from rich.console import Group
    from rich.live import Live
    from rich.markup import escape as rich_escape
    from rich.panel import Panel
    from rich.text import Text

    model_list = [m.strip() for m in models.split(",")]

    adapters = load_adapters(model_list, demo)
    guardian, _DetectedObject3D, _BBox2D, _Position3D = init_safety_guardian(safety, danger_m, caution_m)

    # Handle SIGTERM for graceful shutdown (e.g. systemd stop)
    def _sigterm_handler(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _sigterm_handler)

    cam, source_label = open_input_source(camera, video)

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
    session_start = time.perf_counter()
    total_detections = 0
    latency_samples: list[float] = []
    safety_danger_count = 0
    safety_caution_count = 0

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

                all_rows, all_objects, total_inference_ms = run_detections(adapters, frame, rich_escape)
                total_detections += len(all_rows)
                if total_inference_ms > 0:
                    latency_samples.append(total_inference_ms)

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
                    safety_panel, n_danger, n_caution = build_safety_panel(
                        guardian, all_objects, _DetectedObject3D, _BBox2D, _Position3D, Group,
                    )
                    safety_danger_count += n_danger
                    safety_caution_count += n_caution
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
        print_session_summary(
            frame_count=frame_count,
            session_start=session_start,
            latency_samples=latency_samples,
            total_detections=total_detections,
            safety=safety,
            safety_danger_count=safety_danger_count,
            safety_caution_count=safety_caution_count,
        )
