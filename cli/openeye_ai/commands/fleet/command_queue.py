"""Device command queue — list pending commands."""

from __future__ import annotations

from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from ._helpers import _get, err_console, fleet_app


@fleet_app.command("commands")
def list_commands(
    device_id: Optional[str] = typer.Option(None, "--device", "-d", help="Filter by device ID"),
    status: Optional[str] = typer.Option(None, "--status", "-s", help="Filter by status"),
) -> None:
    """List pending device commands."""
    params = []
    if device_id:
        params.append(f"device_id={device_id}")
    if status:
        params.append(f"status={status}")
    qs = "?" + "&".join(params) if params else ""

    commands = _get(f"/commands{qs}")

    entries = commands if isinstance(commands, list) else commands.get("commands", [])
    if not entries:
        rprint("[dim]No commands found.[/dim]")
        return

    tbl = Table(title="Device Commands")
    tbl.add_column("ID", max_width=12)
    tbl.add_column("Device", max_width=12)
    tbl.add_column("Command", style="cyan")
    tbl.add_column("Status")
    tbl.add_column("Created")
    for c in entries:
        status_val = c.get("status", "?")
        status_style = {"pending": "yellow", "completed": "green", "failed": "red"}.get(status_val, "")
        tbl.add_row(
            c.get("id", "?")[:12],
            c.get("device_id", "?")[:12],
            c.get("command_type", c.get("command", "?")),
            f"[{status_style}]{status_val}[/{status_style}]" if status_style else status_val,
            str(c.get("created_at", "\u2014")),
        )
    err_console.print(tbl)
