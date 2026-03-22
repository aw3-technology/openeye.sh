"""Maintenance window commands — create, list, update, delete."""

from __future__ import annotations


import typer
from rich import print as rprint
from rich.table import Table

from ._helpers import _delete, _get, _patch, _post, err_console, fleet_app


@fleet_app.command("maintenance-create")
def maintenance_create(
    name: str = typer.Option(..., "--name", "-n", help="Window name"),
    start: str = typer.Option(..., "--start", help="Start time (ISO 8601)"),
    end: str = typer.Option(..., "--end", help="End time (ISO 8601)"),
    device_ids: str | None = typer.Option(None, "--devices", "-d", help="Comma-separated device IDs"),
    group_id: str | None = typer.Option(None, "--group", "-g", help="Target group ID"),
) -> None:
    """Create a maintenance window."""
    payload: dict = {
        "name": name,
        "starts_at": start,
        "ends_at": end,
    }
    if device_ids:
        payload["device_ids"] = [d.strip() for d in device_ids.split(",")]
    if group_id:
        payload["group_id"] = group_id
    result = _post("/maintenance", payload)
    rprint(f"[green]Maintenance window created:[/green] {result.get('id', '?')}")


@fleet_app.command("maintenance-list")
def maintenance_list(
    active_only: bool = typer.Option(False, "--active", help="Show only active windows"),
) -> None:
    """List maintenance windows."""
    params = {"active_only": str(active_only).lower()}
    windows = _get("/maintenance", params=params)

    entries = windows if isinstance(windows, list) else windows.get("windows", [])
    if not entries:
        rprint("[dim]No maintenance windows.[/dim]")
        return

    tbl = Table(title="Maintenance Windows")
    tbl.add_column("Name", style="bold")
    tbl.add_column("ID", max_width=12)
    tbl.add_column("Start")
    tbl.add_column("End")
    tbl.add_column("Status")
    for w in entries:
        tbl.add_row(
            w.get("name", "?"),
            w.get("id", "?")[:12],
            str(w.get("starts_at", "\u2014")),
            str(w.get("ends_at", "\u2014")),
            w.get("status", "\u2014"),
        )
    err_console.print(tbl)


@fleet_app.command("maintenance-update")
def maintenance_update(
    window_id: str = typer.Argument(..., help="Maintenance window UUID"),
    name: str | None = typer.Option(None, "--name", "-n", help="New window name"),
    start: str | None = typer.Option(None, "--start", help="New start time (ISO 8601)"),
    end: str | None = typer.Option(None, "--end", help="New end time (ISO 8601)"),
) -> None:
    """Update a maintenance window."""
    payload: dict = {}
    if name:
        payload["name"] = name
    if start:
        payload["starts_at"] = start
    if end:
        payload["ends_at"] = end
    if not payload:
        rprint("[yellow]No fields to update. Use --name, --start, or --end.[/yellow]")
        raise typer.Exit(code=1)
    _patch(f"/maintenance/{window_id}", payload)
    rprint(f"[green]Maintenance window updated:[/green] {window_id[:12]}")


@fleet_app.command("maintenance-delete")
def maintenance_delete(
    window_id: str = typer.Argument(..., help="Maintenance window UUID"),
) -> None:
    """Delete a maintenance window."""
    _delete(f"/maintenance/{window_id}")
    rprint(f"[yellow]Maintenance window deleted:[/yellow] {window_id[:12]}")
