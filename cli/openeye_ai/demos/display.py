"""Rich rendering helpers for the G1 Safety Guardian demo."""

from __future__ import annotations

from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from openeye_ai.demos.audio import state_badge, zone_badge
from openeye_ai.demos.visualization import latency_bar, safety_shield

console = Console()


def build_display(
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
    # Stats panel
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

    # Latency panel
    latency_content = Group(
        Text("  Inference Latency", style="bold"),
        Text(),
        Text("  ").append_text(latency_bar(inference_ms, width=22)),
        Text(),
        Text("  Target: < 30ms", style="dim"),
    )
    latency_panel = Panel(latency_content, title="[bold]Latency[/bold]", border_style="cyan", width=38)

    # Safety Shield
    shield_panel = safety_shield(danger_m, caution_m, zones, status["state"])

    # Zone table
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
            zone_table.add_row(
                zone_badge(zone_val),
                str(track_id),
                f"{distance:.2f}m",
                f"{bearing:.0f} deg",
            )
    else:
        zone_table.add_row(
            zone_badge("safe"),
            "[dim]--[/dim]",
            "[dim]--[/dim]",
            "[dim]--[/dim]",
        )

    # Alerts panel
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

    # Robot status panel
    action_text = Text("  Action: ", style="dim")
    action_text.append(status["action"].upper(), style="bold")

    robot_stats = Text()
    robot_stats.append("  Halts: ", style="dim")
    robot_stats.append(f"{status['halt_count']}", style="bold red")
    robot_stats.append("  Resumes: ", style="dim")
    robot_stats.append(f"{status['resume_count']}", style="bold green")

    details_text = Text()
    if status.get("details"):
        details_text.append(f"  {status['details']}", style="dim")

    robot_content = Group(
        Text.assemble(("  Robot: ", "dim"), state_badge(status["state"])),
        action_text,
        robot_stats,
        details_text,
    )
    robot_panel = Panel(
        robot_content,
        title="[bold]Robot Control[/bold]",
        border_style="red" if status["state"] == "halted" else "green",
    )

    # Compose layout
    top_row = Table(show_header=False, box=None, pad_edge=False, expand=True)
    top_row.add_column(ratio=3)
    top_row.add_column(ratio=4)
    top_row.add_column(ratio=4)
    top_row.add_row(stats_panel, latency_panel, shield_panel)

    full_display = Group(
        top_row,
        zone_table,
        alerts_panel,
        robot_panel,
        Text("  Press Ctrl+C to stop", style="dim"),
    )

    return Panel(
        full_display,
        title="[bold cyan]OpenEye Safety Guardian -- Unitree G1 Demo[/bold cyan]",
        subtitle="[dim]openeye g1-demo[/dim]",
        border_style="cyan",
    )


def print_startup_banner(
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


def print_summary(frame_count: int, halt_count: int, resume_count: int) -> None:
    """Print the shutdown summary panel."""
    summary_table = Table(show_header=False, box=None)
    summary_table.add_column("key", style="dim")
    summary_table.add_column("val", style="bold")
    summary_table.add_row("Total frames", str(frame_count))
    summary_table.add_row("Halts issued", str(halt_count))
    summary_table.add_row("Resumes issued", str(resume_count))

    console.print()
    console.print(Panel(
        summary_table,
        title="[bold]Demo Complete[/bold]",
        border_style="cyan",
    ))
