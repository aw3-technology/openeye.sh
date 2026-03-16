"""Device group commands — create, list, membership, scaling."""

from __future__ import annotations

from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from ._helpers import _delete, _get, _post, _put, err_console, fleet_app


@fleet_app.command("group-create")
def group_create(
    name: str = typer.Argument(..., help="Group name"),
    description: str = typer.Option("", "--desc", "-d", help="Group description"),
) -> None:
    """Create a device group."""
    result = _post("/groups", {"name": name, "description": description})
    rprint(f"[green]Group created:[/green] {result['id']}")


@fleet_app.command("groups")
def list_groups() -> None:
    """List device groups."""
    groups = _get("/groups")
    tbl = Table(title="Device Groups")
    tbl.add_column("Name", style="bold")
    tbl.add_column("ID", max_width=12)
    tbl.add_column("Devices")
    tbl.add_column("Scaling")
    for g in groups:
        scaling = g.get("auto_scaling_policy")
        tbl.add_row(
            g["name"],
            g["id"][:12],
            str(g.get("device_count", 0)),
            "On" if scaling and scaling.get("enabled") else "Off",
        )
    err_console.print(tbl)


@fleet_app.command("group-add")
def group_add_device(
    group_id: str = typer.Argument(..., help="Group UUID"),
    device_id: str = typer.Argument(..., help="Device UUID to add"),
) -> None:
    """Add a device to a group."""
    _post(f"/groups/{group_id}/members", {"device_id": device_id})
    rprint(f"[green]Device {device_id[:12]} added to group {group_id[:12]}[/green]")


@fleet_app.command("group-remove")
def group_remove_device(
    group_id: str = typer.Argument(..., help="Group UUID"),
    device_id: str = typer.Argument(..., help="Device UUID to remove"),
) -> None:
    """Remove a device from a group."""
    _delete(f"/groups/{group_id}/members/{device_id}")
    rprint(f"[yellow]Device {device_id[:12]} removed from group {group_id[:12]}[/yellow]")


@fleet_app.command("group-members")
def group_members(
    group_id: str = typer.Argument(..., help="Group UUID"),
) -> None:
    """List devices in a group."""
    members = _get(f"/groups/{group_id}/members")

    entries = members if isinstance(members, list) else members.get("members", [])
    if not entries:
        rprint("[dim]No members in this group.[/dim]")
        return

    tbl = Table(title=f"Group Members: {group_id[:12]}")
    tbl.add_column("Name", style="bold")
    tbl.add_column("ID", max_width=12)
    tbl.add_column("Type")
    tbl.add_column("Status")
    for d in entries:
        status_style = {"online": "green", "offline": "dim", "error": "red"}.get(d.get("status", ""), "")
        tbl.add_row(
            d.get("name", "?"),
            d.get("id", d.get("device_id", "?"))[:12],
            d.get("device_type", "\u2014"),
            f"[{status_style}]{d.get('status', '?')}[/{status_style}]" if status_style else d.get("status", "?"),
        )
    err_console.print(tbl)


@fleet_app.command("group-scaling")
def group_scaling(
    group_id: str = typer.Argument(..., help="Group UUID"),
    enabled: bool = typer.Option(True, "--enabled/--disabled", help="Enable or disable auto-scaling"),
    min_devices: int = typer.Option(1, "--min", help="Minimum devices"),
    max_devices: int = typer.Option(10, "--max", help="Maximum devices"),
    target_cpu: float = typer.Option(70.0, "--target-cpu", help="Target CPU percentage"),
) -> None:
    """Set auto-scaling policy for a device group."""
    policy = {
        "enabled": enabled,
        "min_devices": min_devices,
        "max_devices": max_devices,
        "target_cpu_percent": target_cpu,
    }
    _put(f"/groups/{group_id}/scaling", policy)
    state = "enabled" if enabled else "disabled"
    rprint(f"[green]Auto-scaling {state}[/green] (min={min_devices}, max={max_devices}, cpu={target_cpu}%)")
