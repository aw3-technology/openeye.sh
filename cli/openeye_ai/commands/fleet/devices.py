"""Device management commands — register, ls, info, restart, decommission, tag, config, resources, batch."""

from __future__ import annotations

import json
from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from ._helpers import _delete, _get, _post, _put, err_console, fleet_app


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
    status: Optional[str] = typer.Option(None, "--status", "-s"),
    device_type: Optional[str] = typer.Option(None, "--type", "-t"),
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
            d.get("current_model_version") or "\u2014",
            d.get("last_heartbeat_at", "\u2014") or "\u2014",
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
    rprint("[green]Tags updated[/green]")


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


@fleet_app.command("resources")
def device_resources(
    device_id: str = typer.Argument(..., help="Device UUID"),
    limit: int = typer.Option(20, "--limit", "-n", help="Number of data points"),
) -> None:
    """Show resource usage history for a device."""
    data = _get(f"/devices/{device_id}/resources?limit={limit}")

    entries = data if isinstance(data, list) else data.get("entries", [])
    if not entries:
        rprint("[dim]No resource data available.[/dim]")
        return

    tbl = Table(title=f"Resource Usage: {device_id[:12]}")
    tbl.add_column("Time", style="dim")
    tbl.add_column("CPU %", justify="right")
    tbl.add_column("Memory %", justify="right")
    tbl.add_column("Disk %", justify="right")
    tbl.add_column("Infer/s", justify="right", style="cyan")
    tbl.add_column("GPU %", justify="right")

    for e in entries:
        cpu = e.get("cpu_percent", 0)
        mem = e.get("memory_percent", 0)
        cpu_style = "green" if cpu < 70 else "yellow" if cpu < 90 else "red"
        mem_style = "green" if mem < 70 else "yellow" if mem < 90 else "red"
        tbl.add_row(
            str(e.get("timestamp", "\u2014")),
            f"[{cpu_style}]{cpu:.1f}[/{cpu_style}]",
            f"[{mem_style}]{mem:.1f}[/{mem_style}]",
            f"{e.get('disk_percent', 0):.1f}",
            str(e.get("inference_rate", "\u2014")),
            f"{e.get('gpu_percent', 0):.1f}" if e.get("gpu_percent") is not None else "\u2014",
        )
    err_console.print(tbl)


@fleet_app.command("batch")
def batch_command(
    command: str = typer.Argument(..., help="Command to send: restart, update_config, update_model"),
    tag_filter: Optional[str] = typer.Option(None, "--tag", "-t", help="Tag filter as key=value"),
    payload_json: Optional[str] = typer.Option(None, "--payload", "-p", help="JSON payload for the command"),
) -> None:
    """Send a batch command to devices matching a tag filter."""
    body: dict = {"command": command}
    if tag_filter:
        if "=" not in tag_filter:
            rprint("[red]Tag filter must be key=value format[/red]")
            raise typer.Exit(code=1)
        k, v = tag_filter.split("=", 1)
        body["tag_filter"] = {k: v}
    if payload_json:
        try:
            body["payload"] = json.loads(payload_json)
        except json.JSONDecodeError:
            rprint("[red]Invalid JSON payload[/red]")
            raise typer.Exit(code=1)
    result = _post("/devices/batch", body)
    rprint(f"[green]Batch command sent:[/green] {result.get('affected_devices', '?')} devices")
