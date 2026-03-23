"""Safety panel and session summary for the watch command.

Extracted from watch_helpers.py to keep that module under 200 lines.
"""

from __future__ import annotations

import time

from rich.table import Table

from openeye_ai._cli_helpers import console
from openeye_ai.utils.safety_helpers import count_humans, detections_to_3d


def build_safety_panel(guardian, all_objects, DetectedObject3D, BBox2D, Position3D, Group):
    """Build the Safety Guardian Rich panel.

    Returns ``(panel, n_danger, n_caution)``.
    """
    from rich.panel import Panel
    from rich.text import Text

    # Convert flat detections → 3-D objects
    objects_3d = detections_to_3d(
        {"objects": all_objects}, BBox2D, DetectedObject3D, Position3D,
    )

    alerts, zones = guardian.evaluate(objects_3d)
    n_humans = count_humans(objects_3d)

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
