"""Retraining pipeline commands for the MLOps CLI."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console


def mlops_retrain(
    pipeline_name: str = typer.Argument(help="Pipeline name to trigger"),
    triggered_by: str = typer.Option("manual", "--by", help="Who triggered this"),
) -> None:
    """Trigger a retraining run for a pipeline."""
    from openeye_ai.mlops.retraining import execute_retraining, trigger_retraining

    try:
        run = trigger_retraining(pipeline_name, triggered_by=triggered_by)
        rprint(f"[green]Retraining triggered: {run.id}[/green]")
        rprint(f"  Pipeline: {pipeline_name} | Executing...")
        run = execute_retraining(run.id)
        rprint(f"  Status: {run.status.value}")
        if run.logs:
            for log in run.logs[-3:]:
                rprint(f"  [dim]{log[:200]}[/dim]")
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


def mlops_pipeline_create(
    name: str = typer.Option(..., "--name", "-n", help="Pipeline name"),
    model_key: str = typer.Option("default", "--model", "-m", help="Model key"),
    training_script: str = typer.Option("train.py", "--script", help="Training script path"),
    dataset_path: str = typer.Option("", "--dataset", "-d", help="Dataset path"),
    schedule: str | None = typer.Option(None, "--schedule", help="Cron schedule, e.g. '0 2 * * *'"),
) -> None:
    """Create a retraining pipeline with optional cron schedule."""
    from openeye_ai.mlops.retraining import create_pipeline
    from openeye_ai.mlops.schemas import RetrainingPipelineConfig, RetrainingTrigger

    trigger = RetrainingTrigger.SCHEDULED if schedule else RetrainingTrigger.MANUAL

    config = RetrainingPipelineConfig(
        name=name,
        model_key=model_key,
        trigger=trigger,
        training_script=training_script,
        dataset_path=dataset_path,
        schedule_cron=schedule,
        training_args={},
        validation_tests=[],
    )
    pipeline = create_pipeline(config)
    rprint(f"[green]Pipeline created:[/green] {pipeline.name}")
    rprint(f"  Model: {pipeline.model_key} | Script: {pipeline.training_script}")
    if schedule:
        rprint(f"  Schedule: {schedule}")


def mlops_pipelines(
    model_key: str | None = typer.Option(None, "--model", "-m", help="Filter by model key"),
) -> None:
    """List retraining pipelines."""
    from openeye_ai.mlops.retraining import list_pipelines

    pipelines = list_pipelines(model_key)
    if not pipelines:
        rprint("[dim]No retraining pipelines found.[/dim]")
        return

    table = Table(title="Retraining Pipelines")
    table.add_column("Name", style="cyan")
    table.add_column("Model")
    table.add_column("Trigger")
    table.add_column("Script")
    table.add_column("Schedule")

    for p in pipelines:
        table.add_row(
            p.name,
            p.model_key,
            p.trigger.value if hasattr(p.trigger, "value") else str(p.trigger),
            p.training_script,
            p.schedule_cron or "—",
        )
    console.print(table)


def mlops_runs(
    pipeline: str | None = typer.Option(None, "--pipeline", "-p", help="Filter by pipeline name"),
    model_key: str | None = typer.Option(None, "--model", "-m", help="Filter by model key"),
) -> None:
    """List retraining runs with status and metrics."""
    from openeye_ai.mlops.retraining import list_runs

    runs = list_runs(pipeline, model_key)
    if not runs:
        rprint("[dim]No retraining runs found.[/dim]")
        return

    table = Table(title="Retraining Runs")
    table.add_column("ID", style="cyan", max_width=12)
    table.add_column("Pipeline")
    table.add_column("Model")
    table.add_column("Status", style="magenta")
    table.add_column("Triggered By")
    table.add_column("New Version")
    table.add_column("Started")

    for r in runs:
        status_style = {"completed": "green", "running": "yellow", "failed": "red"}.get(r.status.value, "")
        table.add_row(
            r.id[:12],
            r.pipeline_name,
            r.model_key,
            f"[{status_style}]{r.status.value}[/{status_style}]" if status_style else r.status.value,
            r.triggered_by,
            r.new_version or "—",
            r.started_at or "—",
        )
    console.print(table)


def mlops_run_status(
    run_id: str = typer.Argument(help="Retraining run ID"),
) -> None:
    """Show details of a specific retraining run."""
    from openeye_ai.mlops.retraining import get_run

    try:
        r = get_run(run_id)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    rprint(f"[bold]Run:[/bold] {r.id}")
    rprint(f"  Pipeline: {r.pipeline_name} | Model: {r.model_key}")
    rprint(f"  Status: {r.status.value} | Triggered by: {r.triggered_by}")
    if r.new_version:
        rprint(f"  New version: {r.new_version}")
    if r.metrics:
        rprint(f"  Accuracy: {r.metrics.accuracy:.1%}" if r.metrics.accuracy else "")
    if r.logs:
        rprint("[dim]Recent logs:[/dim]")
        for log in r.logs[-5:]:
            rprint(f"  [dim]{log[:200]}[/dim]")
