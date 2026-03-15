"""Fleet group and alert commands — group-create, groups, alerts."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai.fleet_cli import fleet_app
from openeye_ai.fleet_cli._helpers import _get, _post, err_console

@fleet_app.command("group-create")
def group_create(
    name: str = typer.Argument(..., help="Group name"),
    description: str = typer.Option("", "--desc", "-d"),
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

@fleet_app.command("alerts")
def list_alerts(
    resolved: bool | None = typer.Option(None, "--resolved"),
) -> None:
    """List fleet alerts."""
    qs = ""
    if resolved is not None:
        qs = f"?resolved={str(resolved).lower()}"
    alerts = _get(f"/alerts{qs}")

    tbl = Table(title="Fleet Alerts")
    tbl.add_column("Severity")
    tbl.add_column("Type")
    tbl.add_column("Title")
    tbl.add_column("Resolved")
    tbl.add_column("Time")
    for a in alerts:
        sev_style = {"critical": "bold red", "error": "red", "warning": "yellow"}.get(a["severity"], "")
        tbl.add_row(
            f"[{sev_style}]{a['severity']}[/{sev_style}]" if sev_style else a["severity"],
            a["alert_type"],
            a["title"],
            "[green]Yes[/green]" if a["resolved"] else "[dim]No[/dim]",
            a.get("created_at", "—"),
        )
    err_console.print(tbl)
