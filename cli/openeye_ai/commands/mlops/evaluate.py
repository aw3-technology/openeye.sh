"""Evaluation commands — benchmarking, batch inference, validation."""

from __future__ import annotations

from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console, dependency_error
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import get_adapter, is_downloaded

evaluate_app = typer.Typer()


# ── Benchmark Matrix ──────────────────────────────────────────────────


@evaluate_app.command("benchmark")
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


# ── Batch Inference ───────────────────────────────────────────────────


@evaluate_app.command("batch")
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


# ── Validation Tests ──────────────────────────────────────────────────


@evaluate_app.command("validate")
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


@evaluate_app.command("validation-create")
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


@evaluate_app.command("validations")
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


@evaluate_app.command("validation-runs")
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
