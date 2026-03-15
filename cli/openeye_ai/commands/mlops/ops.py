"""MLOps operational commands — retrain, batch, export, annotate, feedback."""

from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint

from openeye_ai._cli_helpers import console, dependency_error
from openeye_ai.commands.mlops._app import mlops_app
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import get_adapter, is_downloaded

@mlops_app.command("retrain")
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

@mlops_app.command("batch")
def mlops_batch(
    model_key: str = typer.Argument(help="Model key"),
    model_version: str = typer.Argument(help="Model version"),
    input_path: str = typer.Argument(help="Input dataset path (local dir, s3://, gs://)"),
    output_path: str = typer.Argument(help="Output path for results"),
    batch_size: int = typer.Option(32, "--batch-size", help="Batch size"),
    workers: int = typer.Option(4, "--workers", help="Number of workers"),
    output_format: str = typer.Option("jsonl", "--format", help="Output format: jsonl, csv"),
) -> None:
    """Run batch inference on a dataset."""
    from openeye_ai.mlops.batch_inference import create_batch_job, run_batch_inference
    from openeye_ai.mlops.schemas import BatchInferenceConfig, StorageBackend

    backend = StorageBackend.LOCAL
    if input_path.startswith("s3://"):
        backend = StorageBackend.S3
    elif input_path.startswith("gs://"):
        backend = StorageBackend.GCS

    config = BatchInferenceConfig(
        name=f"batch-{model_key}-{model_version}",
        model_key=model_key,
        model_version=model_version,
        input_path=input_path,
        output_path=output_path,
        storage_backend=backend,
        batch_size=batch_size,
        max_workers=workers,
        output_format=output_format,
    )
    job = create_batch_job(config)
    rprint(f"[green]Batch job created: {job.id}[/green]")

    if not is_downloaded(model_key):
        rprint(f"[yellow]Model '{model_key}' not downloaded. Job queued but not executed.[/yellow]")
        return

    try:
        adapter = get_adapter(model_key)
        model_dir = MODELS_DIR / model_key
        with console.status(f"Loading {model_key}..."):
            adapter.load(model_dir)
    except (ImportError, Exception) as e:
        rprint(f"[yellow]Could not load model: {e}. Job queued but not executed.[/yellow]")
        return

    rprint(f"[bold]Running batch inference...[/bold]")
    job = run_batch_inference(job.id, adapter)
    rprint(f"  Status: {job.status.value} | Input: {input_path} -> Output: {job.result_path or output_path}")

@mlops_app.command("export")
def mlops_export(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
    target_format: str = typer.Argument(help="Export format: onnx, tensorrt, coreml"),
    output: Path | None = typer.Option(None, "--output", "-o", help="Output path"),
    quantize: bool = typer.Option(False, "--quantize", help="Apply INT8 quantization"),
) -> None:
    """Export a model to ONNX, TensorRT, or CoreML format for edge deployment."""
    from openeye_ai.mlops.export import export_model
    from openeye_ai.mlops.schemas import ExportFormat, ExportRequest

    try:
        fmt = ExportFormat(target_format)
    except ValueError:
        rprint(f"[red]Invalid format '{target_format}'. Use: onnx, tensorrt, coreml[/red]")
        raise typer.Exit(code=1)

    request = ExportRequest(
        model_key=model_key,
        model_version=version,
        target_format=fmt,
        output_path=str(output) if output else None,
        quantize=quantize,
    )

    try:
        with console.status(f"Exporting {model_key} v{version} to {target_format}..."):
            result = export_model(request)
        rprint(f"[green]Exported to: {result.output_path}[/green]")
        rprint(f"  Size: {result.output_size_mb:.1f} MB | Duration: {result.export_duration_seconds:.1f}s")
    except (FileNotFoundError, ValueError, NotImplementedError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

@mlops_app.command("annotate")
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

@mlops_app.command("feedback")
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
