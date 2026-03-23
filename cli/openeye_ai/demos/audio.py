from __future__ import annotations

from rich.text import Text


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
