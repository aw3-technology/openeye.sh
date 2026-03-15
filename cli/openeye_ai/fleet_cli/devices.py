"""Fleet device commands — register, ls, info, restart, decommission, tag, config."""

from __future__ import annotations

import json

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai.fleet_cli import fleet_app
from openeye_ai.fleet_cli._helpers import _get, _post, _put, _delete, err_console

@fleet_app.command("register")
def register(
    name: str = typer.Argument(..., help="Device name"),
    device_type: str = typer.Option("edge_node", "--type", "-t", help="camera|robot|edge_node|gateway|drone"),
) -> None:
    """Register a new device in the fleet."""
    result = _post("/devices", {"name": name, "device_type": device_type})
    rprint(f"[green]Device registered:[/green] {result['id']}")
    if result.get("api_key"):
        rprint(f"[bold yellow]API Key (save now!):[/bold yellow] {result['api_key']}")

@fleet_app.command("ls")
def list_devices(
    status: str | None = typer.Option(None, "--status", "-s"),
    device_type: str | None = typer.Option(None, "--type", "-t"),
) -> None:
    """List all devices."""
    qs = ""
    params = []
    if status:
        params.append(f"status={status}")
    if device_type:
        params.append(f"device_type={device_type}")
    if params:
        qs = "?" + "&".join(params)

    devices = _get(f"/devices{qs}")

    tbl = Table(title="Devices")
    tbl.add_column("Name", style="bold")
    tbl.add_column("ID", max_width=12)
    tbl.add_column("Type")
    tbl.add_column("Status")
    tbl.add_column("Model")
    tbl.add_column("Last Heartbeat")
    for d in devices:
        status_style = {"online": "green", "offline": "dim", "error": "red"}.get(d["status"], "")
        tbl.add_row(
            d["name"],
            d["id"][:12],
            d["device_type"],
            f"[{status_style}]{d['status']}[/{status_style}]" if status_style else d["status"],
            d.get("current_model_version") or "—",
            d.get("last_heartbeat_at", "—") or "—",
        )
    err_console.print(tbl)

@fleet_app.command("info")
def device_info(
    device_id: str = typer.Argument(..., help="Device UUID"),
) -> None:
    """Show device details."""
    d = _get(f"/devices/{device_id}")
    print(json.dumps(d, indent=2, default=str))

@fleet_app.command("restart")
def restart(
    device_id: str = typer.Argument(..., help="Device UUID"),
) -> None:
    """Send restart command to a device."""
    result = _post(f"/devices/{device_id}/restart")
    rprint(f"[green]Restart queued:[/green] command={result.get('command_id', '?')}")

@fleet_app.command("decommission")
def decommission(
    device_id: str = typer.Argument(..., help="Device UUID"),
    reason: str = typer.Option("", "--reason", "-r"),
    wipe: bool = typer.Option(False, "--wipe"),
) -> None:
    """Decommission a device."""
    result = _delete(f"/devices/{device_id}", {"reason": reason, "wipe_data": wipe})
    rprint(f"[yellow]Device decommissioned:[/yellow] {result.get('id', device_id)}")

@fleet_app.command("tag")
def tag(
    device_id: str = typer.Argument(..., help="Device UUID"),
    tags: list[str] = typer.Argument(..., help="Tags as key=value pairs"),
) -> None:
    """Set tags on a device (key=value pairs)."""
    tag_dict = {}
    for t in tags:
        if "=" not in t:
            rprint(f"[red]Invalid tag format '{t}', expected key=value[/red]")
            raise typer.Exit(code=1)
        k, v = t.split("=", 1)
        tag_dict[k] = v
    _put(f"/devices/{device_id}/tags", tag_dict)
    rprint(f"[green]Tags updated[/green]")

@fleet_app.command("config")
def config_override(
    device_id: str = typer.Argument(..., help="Device UUID"),
    config_json: str = typer.Argument(..., help="JSON config string"),
) -> None:
    """Set config overrides on a device."""
    try:
        cfg = json.loads(config_json)
    except json.JSONDecodeError:
        rprint("[red]Invalid JSON[/red]")
        raise typer.Exit(code=1)
    _put(f"/devices/{device_id}/config", cfg)
    rprint("[green]Config updated[/green]")
