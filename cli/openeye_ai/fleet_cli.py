"""Fleet & Device Management CLI commands — `openeye fleet ...`."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Optional

import typer
from rich import print as rprint
from rich.console import Console
from rich.table import Table

fleet_app = typer.Typer(help="Fleet & device management for edge AI.")

err_console = Console(stderr=True)

# ── Helpers ──────────────────────────────────────────────────────

_BASE_URL = os.environ.get("OPENEYE_FLEET_URL", "http://localhost:8001")
_TOKEN = os.environ.get("OPENEYE_TOKEN", "")


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_TOKEN}",
        "Content-Type": "application/json",
    }


def _ensure_token() -> None:
    if not _TOKEN:
        rprint(
            "[red]Error: OPENEYE_TOKEN environment variable is not set.[/red]\n"
            "Set it with: [bold]export OPENEYE_TOKEN=<your-token>[/bold]"
        )
        raise typer.Exit(code=1)


def _request(method: str, path: str, data: dict | None = None) -> dict:
    import httpx

    _ensure_token()
    try:
        r = httpx.request(
            method,
            f"{_BASE_URL}{path}",
            headers=_headers(),
            json=data if data is not None else (None if method == "GET" else {}),
            timeout=30,
        )
        if r.status_code == 204:
            return {}
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError:
        rprint(f"[red]Error: Cannot connect to fleet server at {_BASE_URL}[/red]")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as exc:
        detail = ""
        try:
            detail = exc.response.json().get("detail", "")
        except Exception:
            pass
        rprint(f"[red]Error {exc.response.status_code}: {detail or exc.response.text[:200]}[/red]")
        raise typer.Exit(code=1)
    except httpx.TimeoutException:
        rprint("[red]Error: Request timed out[/red]")
        raise typer.Exit(code=1)


def _get(path: str) -> dict:
    return _request("GET", path)


def _post(path: str, data: dict | None = None) -> dict:
    return _request("POST", path, data)


def _put(path: str, data: dict | None = None) -> dict:
    return _request("PUT", path, data)


def _patch(path: str, data: dict) -> dict:
    return _request("PATCH", path, data)


def _delete(path: str, data: dict | None = None) -> dict:
    return _request("DELETE", path, data)


# ── 131: Register ────────────────────────────────────────────────


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


# ── 132: List ────────────────────────────────────────────────────


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
            d.get("current_model_version") or "—",
            d.get("last_heartbeat_at", "—") or "—",
        )
    err_console.print(tbl)


# ── Info ─────────────────────────────────────────────────────────


@fleet_app.command("info")
def device_info(
    device_id: str = typer.Argument(..., help="Device UUID"),
) -> None:
    """Show device details."""
    d = _get(f"/devices/{device_id}")
    print(json.dumps(d, indent=2, default=str))


# ── 136: Restart ─────────────────────────────────────────────────


@fleet_app.command("restart")
def restart(
    device_id: str = typer.Argument(..., help="Device UUID"),
) -> None:
    """Send restart command to a device."""
    result = _post(f"/devices/{device_id}/restart")
    rprint(f"[green]Restart queued:[/green] command={result.get('command_id', '?')}")


# ── 145: Decommission ───────────────────────────────────────────


@fleet_app.command("decommission")
def decommission(
    device_id: str = typer.Argument(..., help="Device UUID"),
    reason: str = typer.Option("", "--reason", "-r"),
    wipe: bool = typer.Option(False, "--wipe"),
) -> None:
    """Decommission a device."""
    result = _delete(f"/devices/{device_id}", {"reason": reason, "wipe_data": wipe})
    rprint(f"[yellow]Device decommissioned:[/yellow] {result.get('id', device_id)}")


# ── 137: Tags ────────────────────────────────────────────────────


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


# ── 138: Config ──────────────────────────────────────────────────


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


# ── 133: Deploy ──────────────────────────────────────────────────


@fleet_app.command("deploy")
def deploy(
    name: str = typer.Option(..., "--name", "-n", help="Deployment name"),
    model_id: str = typer.Option(..., "--model", "-m", help="Model ID"),
    model_version: str = typer.Option(..., "--version", "-v", help="Model version"),
    strategy: str = typer.Option("canary", "--strategy", help="canary|rolling|blue_green|all_at_once"),
    group_id: Optional[str] = typer.Option(None, "--group", "-g"),
    model_url: Optional[str] = typer.Option(None, "--url"),
) -> None:
    """Create a staged model deployment."""
    valid_strategies = {"canary", "rolling", "blue_green", "all_at_once"}
    if strategy not in valid_strategies:
        rprint(f"[red]Invalid strategy '{strategy}'. Must be one of: {', '.join(sorted(valid_strategies))}[/red]")
        raise typer.Exit(code=1)
    payload = {
        "name": name,
        "model_id": model_id,
        "model_version": model_version,
        "strategy": strategy,
    }
    if group_id:
        payload["target_group_id"] = group_id
    if model_url:
        payload["model_url"] = model_url
    result = _post("/deployments", payload)
    rprint(f"[green]Deployment created:[/green] {result['id']}")


# ── 134: Rollback ────────────────────────────────────────────────


@fleet_app.command("rollback")
def rollback(
    deployment_id: str = typer.Argument(..., help="Deployment UUID"),
) -> None:
    """Rollback a deployment to the previous model version."""
    result = _post(f"/deployments/{deployment_id}/rollback")
    rprint(f"[yellow]Rolling back:[/yellow] {result.get('status', '?')}")


# ── List Deployments ─────────────────────────────────────────────


@fleet_app.command("deployments")
def list_deployments(
    status: Optional[str] = typer.Option(None, "--status", "-s"),
) -> None:
    """List deployments."""
    qs = f"?status={status}" if status else ""
    deployments = _get(f"/deployments{qs}")

    tbl = Table(title="Deployments")
    tbl.add_column("Name", style="bold")
    tbl.add_column("ID", max_width=12)
    tbl.add_column("Model")
    tbl.add_column("Strategy")
    tbl.add_column("Status")
    tbl.add_column("Stage")
    for d in deployments:
        stages = d.get("rollout_stages", [])
        tbl.add_row(
            d["name"],
            d["id"][:12],
            f"{d['model_id']} v{d['model_version']}",
            d["strategy"],
            d["status"],
            f"{d.get('current_stage', 0) + 1}/{len(stages)}" if stages else "—",
        )
    err_console.print(tbl)


# ── Groups ───────────────────────────────────────────────────────


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


# ── Alerts ───────────────────────────────────────────────────────


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
            a.get("created_at", "—"),
        )
    err_console.print(tbl)


# ── Agent ────────────────────────────────────────────────────────


@fleet_app.command("agent")
def start_agent(
    device_id: str = typer.Option(..., "--device-id", "-d", help="Device UUID"),
    api_key: str = typer.Option("", "--api-key", "-k", envvar="OPENEYE_DEVICE_API_KEY"),
    server_url: str = typer.Option(_BASE_URL, "--server", "-s"),
    interval: float = typer.Option(15.0, "--interval", help="Heartbeat interval in seconds"),
) -> None:
    """Start the device agent (runs on edge devices)."""
    if not api_key:
        rprint("[red]Error: API key is required. Set --api-key or OPENEYE_DEVICE_API_KEY env var.[/red]")
        raise typer.Exit(code=1)
    if not server_url.startswith(("http://", "https://")):
        rprint("[red]Error: Server URL must start with http:// or https://[/red]")
        raise typer.Exit(code=1)
    if interval < 1:
        rprint("[red]Error: Heartbeat interval must be at least 1 second[/red]")
        raise typer.Exit(code=1)
    try:
        from fleet.agent.agent import DeviceAgent
        from fleet.agent.config import AgentConfig
    except ImportError:
        rprint("[yellow]Running with backend package import path...[/yellow]")
        sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1] / "backend" / "src"))
        from fleet.agent.agent import DeviceAgent
        from fleet.agent.config import AgentConfig

    config = AgentConfig(
        device_id=device_id,
        api_key=api_key,
        server_url=server_url,
        heartbeat_interval=interval,
    )
    agent = DeviceAgent(config)
    rprint(f"[green]Starting device agent[/green] (device={device_id})")
    import signal

    def _sigterm_handler(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _sigterm_handler)

    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        agent.stop()
        rprint("[yellow]Agent stopped[/yellow]")


# ── OTA Update ──────────────────────────────────────────────────


@fleet_app.command("ota")
def ota_update(
    firmware_url: str = typer.Option(..., "--url", "-u", help="Firmware/software URL"),
    version: str = typer.Option(..., "--version", "-v", help="Target version string"),
    group_id: Optional[str] = typer.Option(None, "--group", "-g", help="Target device group"),
    device_ids: Optional[str] = typer.Option(None, "--devices", "-d", help="Comma-separated device IDs"),
    force: bool = typer.Option(False, "--force", help="Force update even if same version"),
) -> None:
    """Push an OTA firmware/software update to devices."""
    payload: dict = {
        "firmware_url": firmware_url,
        "version": version,
        "force": force,
    }
    if group_id:
        payload["target_group_id"] = group_id
    if device_ids:
        payload["target_device_ids"] = [d.strip() for d in device_ids.split(",")]
    result = _post("/ota/update", payload)
    rprint(f"[green]OTA update queued:[/green] {result.get('id', '?')}")
    rprint(f"  Version: {version} | Targets: {result.get('target_count', '?')} devices")


# ── Deployment Advance / Pause ──────────────────────────────────


@fleet_app.command("advance")
def advance_deployment(
    deployment_id: str = typer.Argument(..., help="Deployment UUID"),
) -> None:
    """Advance a canary deployment to the next stage."""
    result = _post(f"/deployments/{deployment_id}/advance")
    rprint(f"[green]Deployment advanced:[/green] stage {result.get('current_stage', '?')}")


@fleet_app.command("pause-deployment")
def pause_deployment(
    deployment_id: str = typer.Argument(..., help="Deployment UUID"),
) -> None:
    """Pause a running deployment."""
    result = _post(f"/deployments/{deployment_id}/pause")
    rprint(f"[yellow]Deployment paused:[/yellow] {result.get('status', '?')}")


# ── Alert Resolution ────────────────────────────────────────────


@fleet_app.command("resolve-alert")
def resolve_alert(
    alert_id: str = typer.Argument(..., help="Alert UUID"),
) -> None:
    """Resolve a fleet alert."""
    _post(f"/alerts/{alert_id}/resolve")
    rprint(f"[green]Alert resolved:[/green] {alert_id}")


# ── Device Resources ────────────────────────────────────────────


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
            str(e.get("timestamp", "—")),
            f"[{cpu_style}]{cpu:.1f}[/{cpu_style}]",
            f"[{mem_style}]{mem:.1f}[/{mem_style}]",
            f"{e.get('disk_percent', 0):.1f}",
            str(e.get("inference_rate", "—")),
            f"{e.get('gpu_percent', 0):.1f}" if e.get("gpu_percent") is not None else "—",
        )
    err_console.print(tbl)


# ── Batch Operations ────────────────────────────────────────────


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


# ── Group Membership ────────────────────────────────────────────


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
            d.get("device_type", "—"),
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


# ── Maintenance Windows ─────────────────────────────────────────


@fleet_app.command("maintenance-create")
def maintenance_create(
    name: str = typer.Option(..., "--name", "-n", help="Window name"),
    start: str = typer.Option(..., "--start", help="Start time (ISO 8601)"),
    end: str = typer.Option(..., "--end", help="End time (ISO 8601)"),
    device_ids: Optional[str] = typer.Option(None, "--devices", "-d", help="Comma-separated device IDs"),
    group_id: Optional[str] = typer.Option(None, "--group", "-g", help="Target group ID"),
) -> None:
    """Create a maintenance window."""
    payload: dict = {
        "name": name,
        "start_time": start,
        "end_time": end,
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
    qs = f"?active_only={str(active_only).lower()}"
    windows = _get(f"/maintenance{qs}")

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
            str(w.get("start_time", "—")),
            str(w.get("end_time", "—")),
            w.get("status", "—"),
        )
    err_console.print(tbl)


@fleet_app.command("maintenance-update")
def maintenance_update(
    window_id: str = typer.Argument(..., help="Maintenance window UUID"),
    name: Optional[str] = typer.Option(None, "--name", "-n"),
    start: Optional[str] = typer.Option(None, "--start"),
    end: Optional[str] = typer.Option(None, "--end"),
) -> None:
    """Update a maintenance window."""
    payload: dict = {}
    if name:
        payload["name"] = name
    if start:
        payload["start_time"] = start
    if end:
        payload["end_time"] = end
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


# ── Commands Queue ──────────────────────────────────────────────


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
            str(c.get("created_at", "—")),
        )
    err_console.print(tbl)
