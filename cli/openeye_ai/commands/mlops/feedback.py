"""Feedback and annotation commands for the MLOps CLI."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console


def mlops_feedback(
    prediction_id: str = typer.Option(..., "--prediction-id", help="Prediction/image ID to correct"),
    correct: str = typer.Option(..., "--correct", help="Whether the prediction was correct (true/false)"),
    label: str = typer.Option("", "--label", help="Correct label (required if --correct false)"),
    model: str = typer.Option("default", "--model", "-m", help="Model key"),
    version: str = typer.Option("latest", "--version", "-v", help="Model version"),
    annotator: str = typer.Option("cli-user", "--annotator", help="Annotator name"),
    notes: str = typer.Option("", "--notes", help="Additional notes"),
) -> None:
    """Submit correction data for a prediction."""
    from openeye_ai.mlops.feedback import annotate_failure
    from openeye_ai.mlops.schemas import AnnotationLabel

    is_correct = correct.lower() in ("true", "1", "yes")

    if is_correct:
        rprint(f"[green]Prediction {prediction_id} confirmed correct.[/green]")
        return

    if not label:
        rprint("[red]--label is required when --correct is false.[/red]")
        raise typer.Exit(code=1)

    ann = annotate_failure(
        model_key=model,
        model_version=version,
        image_source=prediction_id,
        correct_label=label,
        annotation_label=AnnotationLabel.MISCLASSIFICATION,
        annotator=annotator,
        notes=notes,
    )
    rprint(f"[green]Feedback recorded: {ann.id}[/green]")
    rprint(f"  Prediction: {prediction_id} | Correct label: {label}")


def mlops_annotate(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
    image: str = typer.Argument(help="Image path or URI"),
    correct_label: str = typer.Option(..., "--label", help="Correct label"),
    annotation_type: str = typer.Option(
        "misclassification", "--type",
        help="Type: false_positive, false_negative, misclassification, wrong_bbox, low_confidence",
    ),
    predicted: str | None = typer.Option(None, "--predicted", help="What the model predicted"),
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


def mlops_feedback_generate(
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


def mlops_annotations(
    model_key: str | None = typer.Option(None, "--model", "-m", help="Filter by model key"),
    label: str | None = typer.Option(None, "--label", "-l", help="Filter by annotation type"),
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


def mlops_feedback_batches(
    model_key: str | None = typer.Option(None, "--model", "-m", help="Filter by model key"),
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
