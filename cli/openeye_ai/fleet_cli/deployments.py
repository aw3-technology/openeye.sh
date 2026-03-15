"""Fleet deployment commands — deploy, rollback, list deployments."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai.fleet_cli import fleet_app
from openeye_ai.fleet_cli._helpers import _get, _post, err_console

@fleet_app.command("deploy")
def deploy(
    name: str = typer.Option(..., "--name", "-n", help="Deployment name"),
    model_id: str = typer.Option(..., "--model", "-m", help="Model ID"),
    model_version: str = typer.Option(..., "--version", "-v", help="Model version"),
    strategy: str = typer.Option("canary", "--strategy", help="canary|rolling|blue_green|all_at_once"),
    group_id: str | None = typer.Option(None, "--group", "-g"),
    model_url: str | None = typer.Option(None, "--url"),
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

@fleet_app.command("rollback")
def rollback(
    deployment_id: str = typer.Argument(..., help="Deployment UUID"),
) -> None:
    """Rollback a deployment to the previous model version."""
    result = _post(f"/deployments/{deployment_id}/rollback")
    rprint(f"[yellow]Rolling back:[/yellow] {result.get('status', '?')}")

@fleet_app.command("deployments")
def list_deployments(
    status: str | None = typer.Option(None, "--status", "-s"),
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
