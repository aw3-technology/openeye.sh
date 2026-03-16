"""Alert commands — list and resolve."""

from __future__ import annotations

from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from ._helpers import _get, _post, err_console, fleet_app


@fleet_app.command("alerts")
def list_alerts(
    resolved: Optional[bool] = typer.Option(None, "--resolved"),
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
            a.get("created_at", "\u2014"),
        )
    err_console.print(tbl)


@fleet_app.command("resolve-alert")
def resolve_alert(
    alert_id: str = typer.Argument(..., help="Alert UUID"),
) -> None:
    """Resolve a fleet alert."""
    _post(f"/alerts/{alert_id}/resolve")
    rprint(f"[green]Alert resolved:[/green] {alert_id}")
