"""MLOps commands — model lifecycle, A/B testing, batch inference, etc."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console, dependency_error
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import get_adapter, is_downloaded

mlops_app = typer.Typer(help="Model lifecycle & MLOps operations.")


# ── Upload + Register ─────────────────────────────────────────────────


@mlops_app.command("upload")
def mlops_upload(
    file: Path = typer.Argument(help="Path to model file (ONNX, TorchScript, SafeTensors)"),
    name: str = typer.Option(..., "--name", "-n", help="Human-readable model name"),
    key: str = typer.Option(..., "--key", "-k", help="Registry key (slug)"),
    format: str = typer.Option(..., "--format", "-f", help="Model format: onnx, torchscript, safetensors"),
    task: str = typer.Option("detection", "--task", "-t", help="Model task"),
    author: str = typer.Option("", "--author", help="Author name"),
    description: str = typer.Option("", "--description", "-d", help="Model description"),
    adapter: str = typer.Option("onnx_generic", "--adapter", help="Adapter key"),
) -> None:
    """Upload a custom-trained model and register it in the enterprise registry."""
    from openeye_ai.mlops.model_registry import upload_and_register
    from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

    try:
        fmt = ModelFormat(format)
    except ValueError:
        rprint(f"[red]Invalid format '{format}'. Use: onnx, torchscript, safetensors[/red]")
        raise typer.Exit(code=1)

    try:
        req = ModelUploadRequest(
            name=name, key=key, format=fmt, task=task,
            description=description, author=author,
            file_path=str(file), adapter=adapter,
        )
        version = upload_and_register(req)
        rprint(f"[green]Registered '{name}' as '{key}' v{version.version}[/green]")
        rprint(f"  Format: {version.format.value} | Size: {version.file_size_mb:.1f} MB")
    except (FileNotFoundError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


# ── List Registry + Versions ──────────────────────────────────────────


@mlops_app.command("registry")
def mlops_registry() -> None:
    """List all models in the enterprise registry with version history."""
    from openeye_ai.mlops.model_registry import list_registered_models

    models = list_registered_models()
    if not models:
        rprint("[dim]No models in enterprise registry. Use 'openeye mlops upload' to add one.[/dim]")
        return

    table = Table(title="Enterprise Model Registry")
    table.add_column("Key", style="cyan")
    table.add_column("Name", style="bold")
    table.add_column("Task", style="magenta")
    table.add_column("Versions", justify="right")
    table.add_column("Latest", style="green")
    table.add_column("Production", style="yellow")

    for m in models:
        latest = m.latest_version
        prod = m.production_version
        table.add_row(
            m.key,
            m.name,
            m.task,
            str(len(m.versions)),
            latest.version if latest else "—",
            prod.version if prod else "—",
        )
    console.print(table)


@mlops_app.command("versions")
def mlops_versions(
    model_key: str = typer.Argument(help="Model registry key"),
) -> None:
    """List all versions of a model with metadata."""
    from openeye_ai.mlops.model_registry import list_versions

    try:
        versions = list_versions(model_key)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    table = Table(title=f"Versions: {model_key}")
    table.add_column("Version", style="cyan")
    table.add_column("Stage", style="magenta")
    table.add_column("Format")
    table.add_column("Size", justify="right")
    table.add_column("Author")
    table.add_column("Dataset")
    table.add_column("Accuracy", justify="right")
    table.add_column("Created")

    for v in versions:
        acc = f"{v.training_metrics.accuracy:.1%}" if v.training_metrics.accuracy else "—"
        table.add_row(
            v.version, v.stage.value, v.format.value,
            f"{v.file_size_mb:.1f} MB", v.author or "—",
            v.training_dataset or "—", acc,
            v.created_at[:10],
        )
    console.print(table)


# ── Promote ───────────────────────────────────────────────────────────


@mlops_app.command("promote")
def mlops_promote(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Version to promote"),
    stage: str = typer.Argument(help="Target stage: staging or production"),
    requester: str = typer.Option("cli-user", "--requester", help="Requester name"),
    reason: str = typer.Option("", "--reason", help="Reason for promotion"),
) -> None:
    """Promote a model version to a new stage (dev -> staging -> production)."""
    from openeye_ai.mlops.lifecycle import request_promotion
    from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

    try:
        target = ModelStage(stage)
    except ValueError:
        rprint(f"[red]Invalid stage '{stage}'. Use: staging, production, archived[/red]")
        raise typer.Exit(code=1)

    try:
        req = PromotionRequest(
            model_key=model_key, version=version,
            target_stage=target, requester=requester, reason=reason,
        )
        record = request_promotion(req)
        rprint(f"[green]Promotion {record.from_stage.value} -> {record.to_stage.value}: {record.status.value}[/green]")
        if record.approver:
            rprint(f"  Approved by: {record.approver}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


# ── A/B Test ──────────────────────────────────────────────────────────


@mlops_app.command("ab-test")
def mlops_ab_test(
    model_key: str = typer.Argument(help="Model key"),
    version_a: str = typer.Option(..., "--a", help="Control version"),
    version_b: str = typer.Option(..., "--b", help="Challenger version"),
    name: str = typer.Option("", "--name", help="Test name"),
    split: float = typer.Option(0.5, "--split", help="Traffic split to version B (0-1)"),
    max_samples: Optional[int] = typer.Option(None, "--max-samples", help="Stop after N samples"),
) -> None:
    """Create an A/B test between two model versions."""
    from openeye_ai.mlops.ab_testing import create_ab_test
    from openeye_ai.mlops.schemas import ABTestConfig

    config = ABTestConfig(
        name=name or f"{model_key} A/B: {version_a} vs {version_b}",
        model_key=model_key,
        version_a=version_a,
        version_b=version_b,
        traffic_split=split,
        max_samples=max_samples,
    )
    test = create_ab_test(config)
    rprint(f"[green]A/B test created: {test.id}[/green]")
    rprint(f"  {version_a} vs {version_b} | Split: {split:.0%} to B")


@mlops_app.command("ab-status")
def mlops_ab_status(model_key: Optional[str] = typer.Argument(None, help="Filter by model key")) -> None:
    """Show status of A/B tests."""
    from openeye_ai.mlops.ab_testing import list_ab_tests

    tests = list_ab_tests(model_key)
    if not tests:
        rprint("[dim]No A/B tests found.[/dim]")
        return

    table = Table(title="A/B Tests")
    table.add_column("ID", style="cyan")
    table.add_column("Model")
    table.add_column("A (control)")
    table.add_column("B (challenger)")
    table.add_column("Status", style="magenta")
    table.add_column("A Acc", justify="right")
    table.add_column("B Acc", justify="right")
    table.add_column("A Lat", justify="right")
    table.add_column("B Lat", justify="right")
    table.add_column("Winner", style="green")

    for t in tests:
        table.add_row(
            t.id, t.config.model_key,
            t.config.version_a, t.config.version_b,
            t.status.value,
            f"{t.metrics_a.mean_accuracy:.1%}" if t.metrics_a.samples else "—",
            f"{t.metrics_b.mean_accuracy:.1%}" if t.metrics_b.samples else "—",
            f"{t.metrics_a.mean_latency_ms:.1f}ms" if t.metrics_a.samples else "—",
            f"{t.metrics_b.mean_latency_ms:.1f}ms" if t.metrics_b.samples else "—",
            t.winner or "—",
        )
    console.print(table)


# ── Retraining Pipeline ──────────────────────────────────────────────


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


# ── Batch Inference ───────────────────────────────────────────────────


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


# ── Benchmark Matrix ──────────────────────────────────────────────────


@mlops_app.command("benchmark")
def mlops_benchmark(
    model: str = typer.Argument(help="Model name"),
    runs: int = typer.Option(100, "--runs", help="Number of benchmark runs"),
    width: int = typer.Option(640, "--width", help="Test image width"),
    height: int = typer.Option(480, "--height", help="Test image height"),
) -> None:
    """Run cross-hardware benchmark matrix for a model."""
    from openeye_ai.mlops.benchmark_matrix import run_benchmark_matrix

    if not is_downloaded(model):
        rprint(f"[yellow]Model '{model}' not downloaded. Run: openeye pull {model}[/yellow]")
        raise typer.Exit(code=1)

    try:
        adapter = get_adapter(model)
    except ImportError as e:
        dependency_error(model, e)

    model_dir = MODELS_DIR / model
    with console.status(f"Loading {model}..."):
        adapter.load(model_dir)

    rprint(f"[bold]Running benchmark matrix ({runs} runs per target)...[/bold]")
    result = run_benchmark_matrix(adapter, model, "latest", runs_per_target=runs, width=width, height=height)

    table = Table(title=f"Benchmark Matrix: {model}")
    table.add_column("Hardware", style="cyan")
    table.add_column("Mean (ms)", justify="right")
    table.add_column("Median (ms)", justify="right")
    table.add_column("P95 (ms)", justify="right")
    table.add_column("FPS", justify="right", style="green")
    table.add_column("Memory (MB)", justify="right")

    for entry in result.entries:
        table.add_row(
            entry.hardware.value,
            f"{entry.mean_latency_ms:.2f}",
            f"{entry.median_latency_ms:.2f}",
            f"{entry.p95_latency_ms:.2f}",
            f"{entry.throughput_fps:.1f}",
            f"{entry.memory_mb:.0f}" if entry.memory_mb else "—",
        )
    console.print(table)


# ── Validation Test ───────────────────────────────────────────────────


@mlops_app.command("validate")
def mlops_validate(
    model: str = typer.Argument(help="Model name"),
    version: str = typer.Argument(help="Model version"),
    test_id: str = typer.Argument(help="Validation test ID"),
) -> None:
    """Run a validation test against a model version."""
    from openeye_ai.mlops.validation import run_validation_test

    if not is_downloaded(model):
        rprint(f"[yellow]Model '{model}' not downloaded.[/yellow]")
        raise typer.Exit(code=1)

    model_dir = MODELS_DIR / model
    try:
        adapter = get_adapter(model)
        adapter.load(model_dir)
    except ImportError as e:
        dependency_error(model, e)
    except Exception as e:
        rprint(f"[red]Failed to load: {e}[/red]")
        raise typer.Exit(code=1)

    try:
        run = run_validation_test(test_id, model, version, adapter)
    except (KeyError, FileNotFoundError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    status = "[green]PASSED[/green]" if run.passed else "[red]FAILED[/red]"
    rprint(f"Validation: {status}")
    for cr in run.condition_results:
        icon = "[green]v[/green]" if cr.passed else "[red]x[/red]"
        rprint(f"  {icon} {cr.condition} -> actual: {cr.actual_value:.4f}")


# ── Lineage ───────────────────────────────────────────────────────────


@mlops_app.command("lineage")
def mlops_lineage(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
) -> None:
    """Show lineage (provenance) for a model version."""
    from openeye_ai.mlops.lineage import get_lineage_chain

    try:
        chain = get_lineage_chain(model_key, version)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    if not chain:
        rprint(f"[yellow]No lineage recorded for {model_key} v{version}.[/yellow]")
        return

    for i, lineage in enumerate(chain):
        indent = "    " * i
        rprint(f"{indent}[cyan]{lineage.model_key}[/cyan] v{lineage.version}")
        rprint(f"{indent}    Dataset: {lineage.dataset} ({lineage.dataset_size or '?'} samples)")
        rprint(f"{indent}    Commit: {lineage.code_commit[:8] if lineage.code_commit else '—'}")
        rprint(f"{indent}    Framework: {lineage.training_framework or '—'}")
        if lineage.hyperparameters:
            hp = ", ".join(f"{k}={v}" for k, v in lineage.hyperparameters.items())
            rprint(f"{indent}    Hyperparams: {hp}")


# ── Export ────────────────────────────────────────────────────────────


@mlops_app.command("export")
def mlops_export(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
    target_format: str = typer.Argument(help="Export format: onnx, tensorrt, coreml"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Output path"),
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


# ── Shadow Mode ───────────────────────────────────────────────────────


@mlops_app.command("shadow")
def mlops_shadow(
    model_key: str = typer.Argument(help="Model key"),
    prod_version: str = typer.Option(..., "--prod", help="Production version"),
    shadow_version: str = typer.Option(..., "--shadow", help="Shadow version"),
    sample_rate: float = typer.Option(1.0, "--sample-rate", help="Fraction of traffic (0-1)"),
    max_samples: Optional[int] = typer.Option(None, "--max-samples", help="Stop after N samples"),
) -> None:
    """Set up shadow mode for a new model alongside production."""
    from openeye_ai.mlops.shadow_mode import create_shadow_deployment
    from openeye_ai.mlops.schemas import ShadowDeploymentConfig

    config = ShadowDeploymentConfig(
        name=f"shadow-{model_key}-{shadow_version}",
        model_key=model_key,
        production_version=prod_version,
        shadow_version=shadow_version,
        sample_rate=sample_rate,
        max_samples=max_samples,
    )
    dep = create_shadow_deployment(config)
    rprint(f"[green]Shadow deployment created: {dep.id}[/green]")
    rprint(f"  Production: {prod_version} | Shadow: {shadow_version} | Rate: {sample_rate:.0%}")


@mlops_app.command("shadow-status")
def mlops_shadow_status(model_key: Optional[str] = typer.Argument(None, help="Filter by model")) -> None:
    """Show shadow deployment status and comparison metrics."""
    from openeye_ai.mlops.shadow_mode import list_shadow_deployments

    deps = list_shadow_deployments(model_key)
    if not deps:
        rprint("[dim]No shadow deployments found.[/dim]")
        return

    table = Table(title="Shadow Deployments")
    table.add_column("ID", style="cyan")
    table.add_column("Model")
    table.add_column("Production")
    table.add_column("Shadow")
    table.add_column("Status", style="magenta")
    table.add_column("Samples", justify="right")
    table.add_column("Agreement", justify="right")
    table.add_column("Prod Lat", justify="right")
    table.add_column("Shadow Lat", justify="right")

    for d in deps:
        c = d.comparison
        table.add_row(
            d.id, d.config.model_key,
            d.config.production_version, d.config.shadow_version,
            d.status.value, str(c.total_samples),
            f"{c.agreement_rate:.1%}" if c.total_samples else "—",
            f"{c.production_mean_latency_ms:.1f}ms" if c.total_samples else "—",
            f"{c.shadow_mean_latency_ms:.1f}ms" if c.total_samples else "—",
        )
    console.print(table)


# ── Feedback / Annotations ────────────────────────────────────────────


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


# ── Approve / Reject Promotion ────────────────────────────────────────


@mlops_app.command("approve")
def mlops_approve(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
    approver: str = typer.Option("cli-user", "--approver", help="Approver name"),
) -> None:
    """Approve a pending model promotion."""
    from openeye_ai.mlops.lifecycle import approve_promotion

    try:
        record = approve_promotion(model_key, version, approver)
        rprint(f"[green]Promotion approved:[/green] {record.from_stage.value} -> {record.to_stage.value}")
        rprint(f"  Approved by: {record.approver}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@mlops_app.command("reject")
def mlops_reject(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Model version"),
    approver: str = typer.Option("cli-user", "--approver", help="Reviewer name"),
    reason: str = typer.Option("", "--reason", "-r", help="Rejection reason"),
) -> None:
    """Reject a pending model promotion."""
    from openeye_ai.mlops.lifecycle import reject_promotion

    try:
        record = reject_promotion(model_key, version, approver, reason)
        rprint(f"[yellow]Promotion rejected:[/yellow] {record.from_stage.value} -> {record.to_stage.value}")
        if record.reason:
            rprint(f"  Reason: {record.reason}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


# ── Pipeline Management ───────────────────────────────────────────────


@mlops_app.command("pipeline-create")
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


@mlops_app.command("pipelines")
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


@mlops_app.command("runs")
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


@mlops_app.command("run-status")
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


# ── Validation Test Management ────────────────────────────────────────


@mlops_app.command("validation-create")
def mlops_validation_create(
    name: str = typer.Option(..., "--name", "-n", help="Test name"),
    model_key: str = typer.Option(..., "--model", "-m", help="Model key"),
    dataset: str = typer.Option(..., "--dataset", "-d", help="Test dataset path"),
    conditions: str = typer.Option(..., "--conditions", "-c", help="Comma-separated conditions, e.g. 'accuracy > 0.95,latency_ms < 50'"),
    description: str = typer.Option("", "--desc", help="Test description"),
) -> None:
    """Create a validation test definition."""
    from openeye_ai.mlops.validation import create_validation_test

    condition_list = [c.strip() for c in conditions.split(",")]
    try:
        test = create_validation_test(
            name=name,
            model_key=model_key,
            test_dataset=dataset,
            conditions=condition_list,
            description=description,
        )
        rprint(f"[green]Validation test created:[/green] {test.id}")
        rprint(f"  Name: {test.name} | Conditions: {len(condition_list)}")
    except (ValueError, KeyError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@mlops_app.command("validations")
def mlops_validations(
    model_key: Optional[str] = typer.Option(None, "--model", "-m", help="Filter by model key"),
) -> None:
    """List validation test definitions."""
    from openeye_ai.mlops.validation import list_validation_tests

    tests = list_validation_tests(model_key)
    if not tests:
        rprint("[dim]No validation tests found.[/dim]")
        return

    table = Table(title="Validation Tests")
    table.add_column("ID", style="cyan", max_width=12)
    table.add_column("Name", style="bold")
    table.add_column("Model")
    table.add_column("Dataset")
    table.add_column("Conditions")
    table.add_column("Created")

    for t in tests:
        table.add_row(
            t.id[:12],
            t.name,
            t.model_key,
            t.test_dataset,
            str(len(t.conditions)),
            t.created_at[:10],
        )
    console.print(table)


@mlops_app.command("validation-runs")
def mlops_validation_runs(
    test_id: Optional[str] = typer.Option(None, "--test", "-t", help="Filter by test ID"),
    model_key: Optional[str] = typer.Option(None, "--model", "-m", help="Filter by model key"),
) -> None:
    """List validation test runs."""
    from openeye_ai.mlops.validation import list_validation_runs

    runs = list_validation_runs(test_id, model_key)
    if not runs:
        rprint("[dim]No validation runs found.[/dim]")
        return

    table = Table(title="Validation Runs")
    table.add_column("Test ID", max_width=12)
    table.add_column("Model")
    table.add_column("Version")
    table.add_column("Passed")
    table.add_column("Duration", justify="right")
    table.add_column("Run At")

    for r in runs:
        passed_str = "[green]PASS[/green]" if r.passed else "[red]FAIL[/red]"
        table.add_row(
            r.test_id[:12],
            r.model_key,
            r.model_version,
            passed_str,
            f"{r.run_duration_seconds:.1f}s",
            r.run_at[:16] if r.run_at else "—",
        )
    console.print(table)


# ── Exports List ──────────────────────────────────────────────────────


@mlops_app.command("exports")
def mlops_exports(
    model_key: Optional[str] = typer.Option(None, "--model", "-m", help="Filter by model key"),
) -> None:
    """List previous model exports."""
    from openeye_ai.mlops.export import list_exports

    exports = list_exports(model_key)
    if not exports:
        rprint("[dim]No exports found.[/dim]")
        return

    table = Table(title="Model Exports")
    table.add_column("Model", style="cyan")
    table.add_column("Version")
    table.add_column("Format")
    table.add_column("Target", style="magenta")
    table.add_column("Size", justify="right")
    table.add_column("Quantized")
    table.add_column("Duration", justify="right")
    table.add_column("Output Path")

    for e in exports:
        table.add_row(
            e.model_key,
            e.model_version,
            e.source_format.value,
            e.target_format.value,
            f"{e.output_size_mb:.1f} MB",
            "[green]Yes[/green]" if e.quantized else "No",
            f"{e.export_duration_seconds:.1f}s",
            e.output_path,
        )
    console.print(table)


# ── Annotations List ──────────────────────────────────────────────────


@mlops_app.command("annotations")
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


# ── Feedback Batches List ─────────────────────────────────────────────


@mlops_app.command("feedback-batches")
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
