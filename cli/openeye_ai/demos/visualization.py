from __future__ import annotations

from rich.console import Group
from rich.panel import Panel
from rich.text import Text


def latency_bar(ms: float, width: int = 20) -> Text:
    """Build a visual latency bar. Green <30ms, yellow <80ms, red above."""
    max_ms = 150.0
    ratio = min(ms / max_ms, 1.0)
    filled = int(ratio * width)
    empty = width - filled

    if ms < 30:
        style = "bold green"
    elif ms < 80:
        style = "bold yellow"
    else:
        style = "bold red"

    bar = Text()
    bar.append("#" * filled, style=style)
    bar.append("-" * empty, style="dim")
    bar.append(f" {ms:>6.1f}ms", style=style)
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
    lines: list[Text] = []
    lines.append(Text("        SAFETY ZONE MAP", style="bold"))
    lines.append(Text())

    safe_style = "on green" if worst == "safe" else "dim green"
    caution_style = "on yellow" if worst == "caution" else "dim yellow"
    danger_style = "on red" if worst == "danger" else "dim red"

    # Outer safe ring
    row = Text()
    row.append("  ")
    row.append("." * w, style=safe_style)
    lines.append(row)

    # Safe with caution inside
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * (w - 10), style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # All three zones
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * 4, style=caution_style)
    row.append("X" * (w - 18), style=danger_style)
    row.append("~" * 4, style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Robot center
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

    # Mirror of all-three-zones row
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * 4, style=caution_style)
    row.append("X" * (w - 18), style=danger_style)
    row.append("~" * 4, style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Caution fading to safe
    row = Text()
    row.append("  ")
    row.append("." * 5, style=safe_style)
    row.append("~" * (w - 10), style=caution_style)
    row.append("." * 5, style=safe_style)
    lines.append(row)

    # Outer safe ring
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

    return Panel(
        Group(*lines),
        title="[bold]Safety Shield[/bold]",
        border_style=border_style,
        width=42,
    )
