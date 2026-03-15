"""Desktop vision CLI commands — screen capture + VLM analysis."""

from __future__ import annotations

import collections
import signal
import sys
import time
from pathlib import Path

import typer
from rich import print as rprint
from rich.console import Console
from rich.table import Table

desktop_app = typer.Typer(
    name="desktop",
    help="Desktop vision — screen capture and VLM-powered UI understanding.",
    no_args_is_help=True,
)

console = Console()

@desktop_app.command()
def capture(
    output: str = typer.Argument("screenshot.png", help="Output image path"),
    monitor: int = typer.Option(1, "--monitor", "-m", help="Monitor index (1=primary)"),
    region: str | None = typer.Option(
        None, "--region", "-r", help="Capture region as 'left,top,width,height'"
    ),
    scale: float = typer.Option(1.0, "--scale", "-s", help="Scale factor (0.5 = half size)"),
) -> None:
    """Capture a single screenshot and save to a file."""
    from openeye_ai.utils.screen_capture import ScreenCapture

    parsed_region = _parse_region(region) if region else None
    cap = ScreenCapture(monitor=monitor, region=parsed_region, max_fps=0, scale=scale)

    try:
        img = cap.read_pil()
        if img is None:
            rprint("[red]Failed to capture screen.[/red]")
            raise typer.Exit(code=1)

        out_path = Path(output)
        img.save(str(out_path))
        rprint(f"[green]Screenshot saved:[/green] {out_path.resolve()} ({img.width}x{img.height})")
    finally:
        cap.release()

@desktop_app.command()
def watch(
    models: str = typer.Option("yolov8", "--models", "-m", help="Comma-separated model names"),
    monitor: int = typer.Option(1, "--monitor", help="Monitor index (1=primary)"),
    region: str | None = typer.Option(
        None, "--region", "-r", help="Capture region as 'left,top,width,height'"
    ),
    fps: float = typer.Option(5.0, "--fps", help="Max capture FPS"),
    scale: float = typer.Option(1.0, "--scale", "-s", help="Scale factor"),
    demo: bool = typer.Option(False, "--demo", help="Demo mode: warm up models"),
) -> None:
    """Live screen monitoring with real-time detections in terminal."""
    from rich.columns import Columns
    from rich.console import Group
    from rich.live import Live
    from rich.markup import escape as rich_escape
    from rich.panel import Panel
    from rich.text import Text

    from openeye_ai._cli_helpers import console, dependency_error, warmup_adapter
    from openeye_ai.config import MODELS_DIR
    from openeye_ai.registry import get_adapter, get_model_info, is_downloaded
    from openeye_ai.utils.screen_capture import ScreenCapture

    # Load models
    model_list = [m.strip() for m in models.split(",")]
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

    # Handle SIGTERM
    def _sigterm_handler(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _sigterm_handler)

    # Set up screen capture
    parsed_region = _parse_region(region) if region else None
    cap = ScreenCapture(monitor=monitor, region=parsed_region, max_fps=fps, scale=scale)
    source_label = f"monitor {monitor}"
    if parsed_region:
        source_label += f" (region: {region})"

    model_label = ", ".join(model_list)
    header = (
        f"[bold green]* DESKTOP WATCH[/bold green]  "
        f"Models: [bold cyan]{model_label}[/bold cyan]  "
        f"Source: [dim]{source_label}[/dim]  "
        f"Press [bold]Ctrl+C[/bold] to stop"
    )

    frame_times: collections.deque[float] = collections.deque(maxlen=60)
    dropped = 0
    frame_count = 0

    try:
        console.print(Panel(header, border_style="green"))
        with Live(console=console, refresh_per_second=12) as live:
            while True:
                loop_start = time.perf_counter()

                frame = cap.read_pil()
                if frame is None:
                    # Throttle returned None — just sleep briefly
                    time.sleep(0.02)
                    continue
                frame_count += 1

                all_rows: list[tuple[str, str, str, str, str]] = []
                total_inference_ms = 0.0
                for m, adapter in adapters.items():
                    result = adapter.predict(frame)
                    inf_ms = result.get("inference_ms", 0.0)
                    total_inference_ms += inf_ms
                    for obj in result.get("objects", []):
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

                now = time.perf_counter()
                frame_times.append(now)
                if len(frame_times) >= 2:
                    elapsed = frame_times[-1] - frame_times[0]
                    fps_val = (len(frame_times) - 1) / elapsed if elapsed > 0 else 0.0
                else:
                    fps_val = 0.0

                if total_inference_ms < 50:
                    lat_color = "bold green"
                elif total_inference_ms < 100:
                    lat_color = "bold yellow"
                else:
                    lat_color = "bold red"

                stats = Text.assemble(
                    ("  FPS ", "dim"),
                    (f"{fps_val:.1f}", "bold cyan"),
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

                display = Group(stats, layout)
                live.update(
                    Panel(
                        display,
                        title="[bold]OpenEye Desktop Watch[/bold]",
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
        cap.release()
        console.print(
            Panel(
                f"[dim]Desktop watch ended. {frame_count} frames processed.[/dim]",
                border_style="dim",
            )
        )

def _parse_region(region_str: str) -> tuple[int, int, int, int]:
    """Parse 'left,top,width,height' string into a tuple."""
    try:
        parts = [int(x.strip()) for x in region_str.split(",")]
        if len(parts) != 4:
            raise ValueError
        return tuple(parts)  # type: ignore[return-value]
    except (ValueError, AttributeError):
        rprint(f"[red]Invalid region format: '{region_str}'. Use 'left,top,width,height'[/red]")
        raise typer.Exit(code=1)
