"""Deployment commands — deploy, rollback, list, advance, pause, ota."""

from __future__ import annotations

from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from ._helpers import _get, _post, err_console, fleet_app


@fleet_app.command("deploy")
def deploy(
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Deployment name (auto-generated if omitted)"),
    model_id: str = typer.Option(..., "--model", "-m", help="Model ID"),
    model_version: str = typer.Option(..., "--version", "-v", help="Model version"),
    strategy: str = typer.Option("canary", "--strategy", help="canary|rolling|blue_green|all_at_once"),
    group_id: Optional[str] = typer.Option(None, "--group", "-g", help="Target device group ID"),
    model_url: Optional[str] = typer.Option(None, "--url", help="Direct URL to model weights file"),
) -> None:
    """Create a staged model deployment."""
    valid_strategies = {"canary", "rolling", "blue_green", "all_at_once"}
    if strategy not in valid_strategies:
        rprint(f"[red]Invalid strategy '{strategy}'. Must be one of: {', '.join(sorted(valid_strategies))}[/red]")
        raise typer.Exit(code=1)
    resolved_name = name or f"{model_id}-{model_version}"
    payload = {
        "name": resolved_name,
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


@fleet_app.command("rollback")
def rollback(
    deployment_id: str = typer.Argument(..., help="Deployment UUID"),
) -> None:
    """Rollback a deployment to the previous model version."""
    result = _post(f"/deployments/{deployment_id}/rollback")
    rprint(f"[yellow]Rolling back:[/yellow] {result.get('status', '?')}")


@fleet_app.command("deployments")
def list_deployments(
    status: Optional[str] = typer.Option(None, "--status", "-s", help="Filter by status: pending, in_progress, completed, failed, rolled_back"),
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
            f"{d.get('current_stage', 0) + 1}/{len(stages)}" if stages else "\u2014",
        )
    err_console.print(tbl)


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
