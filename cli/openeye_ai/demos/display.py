"""Rich TUI display builders for the G1 Safety Guardian demo."""

from __future__ import annotations

from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

console = Console()


def zone_badge(zone: str) -> Text:
    """Return a Rich Text badge for a safety zone level."""
    if zone == "danger":
        return Text(" DANGER ", style="bold white on red")
    elif zone == "caution":
        return Text(" CAUTION ", style="bold black on yellow")
    return Text("  SAFE  ", style="bold white on green")


def state_badge(state: str) -> Text:
    """Return a Rich Text badge for robot state."""
    if state == "halted":
        return Text(" HALTED ", style="bold white on red")
    elif state == "resuming":
        return Text(" RESUMING ", style="bold black on yellow")
    return Text(" MOVING ", style="bold white on green")


def latency_bar(ms: float, width: int = 20) -> Text:
    """Build a visual latency bar. Green <30ms, yellow <80ms, red above."""
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


def safety_shield(danger_m: float, caution_m: float, zones: list, state: str) -> Panel:
    """Build an ASCII safety zone diagram showing concentric zones around robot."""
    worst = "safe"
    for z in zones:
        zval = z.zone.value if hasattr(z, "zone") else str(z.get("zone", "safe"))
        if zval == "danger":
            worst = "danger"
            break
        elif zval == "caution":
            worst = "caution"

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

    w = 33
    lines.append(Text("        SAFETY ZONE MAP", style="bold"))
    lines.append(Text())

    safe_style = "on green" if worst == "safe" else "dim green"
    caution_style = "on yellow" if worst == "caution" else "dim yellow"
    danger_style = "on red" if worst == "danger" else "dim red"

    # Row 1: Safe outer
    row = Text()
    row.append("  ")
    row.append("." * w, style=safe_style)
    lines.append(row)

    # Row 2: Safe with caution inside
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * (w - 10), style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Row 3: All three zones
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * 4, style=caution_style)
    row.append("X" * (w - 18), style=danger_style)
    row.append("~" * 4, style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Row 4: Robot center
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

    # Row 5: mirror of row 3
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * 4, style=caution_style)
    row.append("X" * (w - 18), style=danger_style)
    row.append("~" * 4, style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Row 6: caution fading to safe
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * (w - 10), style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Row 7: safe outer
    row = Text()
    row.append("  ")
    row.append("." * w, style=safe_style)
    lines.append(row)

    lines.append(Text())

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
        Text(f"  Target: < 30ms", style="dim"),
    )
    latency_panel = Panel(latency_content, title="[bold]Latency[/bold]", border_style="cyan", width=38)

    # Safety shield
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

            badge = zone_badge(zone_val)
            zone_table.add_row(
                badge,
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

    # Robot status
    sb = state_badge(status["state"])
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
        Text.assemble(("  Robot: ", "dim"), sb),
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
