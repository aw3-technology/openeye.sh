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
