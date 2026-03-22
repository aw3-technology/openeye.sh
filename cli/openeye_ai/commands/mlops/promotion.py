"""Promotion sub-commands — promote, approve, reject."""

from __future__ import annotations

import typer
from rich import print as rprint


def mlops_promote(
    model: str = typer.Option(..., "--model", "-m", help="Model key"),
    version: str = typer.Option(..., "--version", "-v", help="Version to promote"),
    from_stage: str = typer.Option(..., "--from", help="Current stage: dev, staging"),
    to_stage: str = typer.Option(..., "--to", help="Target stage: staging, production"),
    requester: str = typer.Option("cli-user", "--requester", help="Requester name"),
    reason: str = typer.Option("", "--reason", help="Reason for promotion"),
) -> None:
    """Promote a model version to a new stage (dev -> staging -> production)."""
    from openeye_ai.mlops.lifecycle import request_promotion
    from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

    try:
        target = ModelStage(to_stage)
    except ValueError:
        rprint(f"[red]Invalid target stage '{to_stage}'. Use: staging, production, archived[/red]")
        raise typer.Exit(code=1)

    try:
        req = PromotionRequest(
            model_key=model, version=version,
            target_stage=target, requester=requester, reason=reason,
        )
        record = request_promotion(req)
        rprint(f"[green]Promotion {record.from_stage.value} -> {record.to_stage.value}: {record.status.value}[/green]")
        if record.approver:
            rprint(f"  Approved by: {record.approver}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


def mlops_approve_promotion(
    model: str = typer.Option(..., "--model", "-m", help="Model key"),
    version: str = typer.Option(..., "--version", "-v", help="Model version"),
    approver: str = typer.Option("cli-user", "--approver", help="Approver name"),
) -> None:
    """Approve a pending model promotion (gated workflow)."""
    from openeye_ai.mlops.lifecycle import approve_promotion

    try:
        record = approve_promotion(model, version, approver)
        rprint(f"[green]Promotion approved:[/green] {record.from_stage.value} -> {record.to_stage.value}")
        rprint(f"  Approved by: {record.approver}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


def mlops_reject_promotion(
    model: str = typer.Option(..., "--model", "-m", help="Model key"),
    version: str = typer.Option(..., "--version", "-v", help="Model version"),
    approver: str = typer.Option("cli-user", "--approver", help="Reviewer name"),
    reason: str = typer.Option("", "--reason", "-r", help="Rejection reason"),
) -> None:
    """Reject a pending model promotion."""
    from openeye_ai.mlops.lifecycle import reject_promotion

    try:
        record = reject_promotion(model, version, approver, reason)
        rprint(f"[yellow]Promotion rejected:[/yellow] {record.from_stage.value} -> {record.to_stage.value}")
        if record.reason:
            rprint(f"  Reason: {record.reason}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)
