"""Training pipeline, retraining, annotations & feedback commands."""

from __future__ import annotations

from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console

train_app = typer.Typer()


# ── Retraining Pipeline ──────────────────────────────────────────────


@train_app.command("retrain")
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


@train_app.command("pipeline-create")
def mlops_pipeline_create(
    name: str = typer.Option(..., "--name", "-n", help="Pipeline name"),
    model_key: str = typer.Option(..., "--model", "-m", help="Model key"),
    training_script: str = typer.Option(..., "--script", help="Training script path"),
    dataset_path: str = typer.Option("", "--dataset", "-d", help="Dataset path"),
    schedule: Optional[str] = typer.Option(None, "--schedule", help="Cron schedule"),
) -> None:
    """Create a retraining pipeline."""
    from openeye_ai.mlops.retraining import create_pipeline
    from openeye_ai.mlops.schemas import RetrainingPipelineConfig

    config = RetrainingPipelineConfig(
        name=name,
        model_key=model_key,
        training_script=training_script,
        dataset_path=dataset_path,
        schedule_cron=schedule,
        training_args={},
        validation_tests=[],
    )
    pipeline = create_pipeline(config)
    rprint(f"[green]Pipeline created:[/green] {pipeline.name}")
    rprint(f"  Model: {pipeline.model_key} | Script: {pipeline.training_script}")


@train_app.command("pipelines")
def mlops_pipelines(
    model_key: Optional[str] = typer.Option(None, "--model", "-m", help="Filter by model key"),
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


@train_app.command("runs")
def mlops_runs(
    pipeline: Optional[str] = typer.Option(None, "--pipeline", "-p", help="Filter by pipeline name"),
    model_key: Optional[str] = typer.Option(None, "--model", "-m", help="Filter by model key"),
) -> None:
    """List retraining runs."""
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


@train_app.command("run-status")
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


# ── Feedback / Annotations ────────────────────────────────────────────


@train_app.command("annotate")
def mlops_annotate(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
    image: str = typer.Argument(help="Image path or URI"),
    correct_label: str = typer.Option(..., "--label", help="Correct label"),
    annotation_type: str = typer.Option(
        "misclassification", "--type",
        help="Type: false_positive, false_negative, misclassification, wrong_bbox, low_confidence",
    ),
    predicted: Optional[str] = typer.Option(None, "--predicted", help="What the model predicted"),
    annotator: str = typer.Option("cli-user", "--annotator", help="Annotator name"),
    notes: str = typer.Option("", "--notes", help="Additional notes"),
) -> None:
    """Annotate an inference failure for feedback into training."""
    from openeye_ai.mlops.feedback import annotate_failure
    from openeye_ai.mlops.schemas import AnnotationLabel

    try:
        label = AnnotationLabel(annotation_type)
    except ValueError:
        rprint(f"[red]Invalid type '{annotation_type}'. Use: false_positive, false_negative, misclassification, wrong_bbox, low_confidence[/red]")
        raise typer.Exit(code=1)

    ann = annotate_failure(
        model_key=model_key,
        model_version=version,
        image_source=image,
        correct_label=correct_label,
        annotation_label=label,
        predicted_label=predicted,
        annotator=annotator,
        notes=notes,
    )
    rprint(f"[green]Annotation created: {ann.id}[/green]")
    rprint(f"  {annotation_type}: predicted={predicted or '—'} -> correct={correct_label}")


@train_app.command("feedback")
def mlops_feedback(
    model_key: str = typer.Argument(help="Model key"),
    output: str = typer.Argument(help="Output dataset path for corrections"),
) -> None:
    """Generate a correction dataset from unfed annotations and feed back into training."""
    from openeye_ai.mlops.feedback import create_feedback_batch, execute_feedback_batch

    try:
        batch = create_feedback_batch(model_key, output)
        batch = execute_feedback_batch(batch.id)
        rprint(f"[green]Feedback batch created: {batch.id}[/green]")
        rprint(f"  Annotations: {batch.total_annotations} | Output: {output}")
        rprint(f"  Status: {batch.status.value}")
    except ValueError as e:
        rprint(f"[yellow]{e}[/yellow]")
        raise typer.Exit(code=1)


@train_app.command("annotations")
def mlops_annotations(
    model_key: Optional[str] = typer.Option(None, "--model", "-m", help="Filter by model key"),
    label: Optional[str] = typer.Option(None, "--label", "-l", help="Filter by annotation type"),
    unfed_only: bool = typer.Option(False, "--unfed", help="Show only unfed annotations"),
) -> None:
    """List inference failure annotations."""
    from openeye_ai.mlops.feedback import list_annotations

    annotation_label = None
    if label:
        from openeye_ai.mlops.schemas import AnnotationLabel
        try:
            annotation_label = AnnotationLabel(label)
        except ValueError:
            rprint(f"[red]Invalid label '{label}'. Use: false_positive, false_negative, misclassification, wrong_bbox, low_confidence[/red]")
            raise typer.Exit(code=1)

    annotations = list_annotations(model_key, annotation_label, unfed_only)
    if not annotations:
        rprint("[dim]No annotations found.[/dim]")
        return

    table = Table(title="Failure Annotations")
    table.add_column("ID", style="cyan", max_width=12)
    table.add_column("Model")
    table.add_column("Version")
    table.add_column("Type", style="magenta")
    table.add_column("Predicted")
    table.add_column("Correct", style="green")
    table.add_column("Fed")
    table.add_column("Annotator")

    for a in annotations:
        table.add_row(
            a.id[:12],
            a.model_key,
            a.model_version,
            a.annotation_label.value if hasattr(a.annotation_label, "value") else str(a.annotation_label),
            a.predicted_label or "—",
            a.correct_label,
            "[green]Yes[/green]" if a.fed_back else "[dim]No[/dim]",
            a.annotator,
        )
    console.print(table)


@train_app.command("feedback-batches")
def mlops_feedback_batches(
    model_key: Optional[str] = typer.Option(None, "--model", "-m", help="Filter by model key"),
) -> None:
    """List feedback batch history."""
    from openeye_ai.mlops.feedback import list_feedback_batches

    batches = list_feedback_batches(model_key)
    if not batches:
        rprint("[dim]No feedback batches found.[/dim]")
        return

    table = Table(title="Feedback Batches")
    table.add_column("ID", style="cyan", max_width=12)
    table.add_column("Model")
    table.add_column("Annotations", justify="right")
    table.add_column("Status", style="magenta")
    table.add_column("Output")
    table.add_column("Created")

    for b in batches:
        status_style = {"completed": "green", "running": "yellow", "failed": "red"}.get(b.status.value, "")
        table.add_row(
            b.id[:12],
            b.model_key,
            str(b.total_annotations),
            f"[{status_style}]{b.status.value}[/{status_style}]" if status_style else b.status.value,
            b.output_dataset_path,
            b.created_at[:10] if b.created_at else "—",
        )
    console.print(table)
