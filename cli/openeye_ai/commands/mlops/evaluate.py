"""Evaluation commands — model evaluation, benchmarking, validation."""

from __future__ import annotations


import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console, dependency_error
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import get_adapter, is_downloaded

evaluate_app = typer.Typer()


# ── Model Evaluation (precision/recall/mAP) ─────────────────────────


@evaluate_app.command("evaluate")
def mlops_evaluate(
    model: str = typer.Argument(help="Model name"),
    dataset: str = typer.Option(..., "--dataset", "-d", help="Path to evaluation dataset (COCO JSON, JSONL, or image dir)"),
    version: str = typer.Option("latest", "--version", "-v", help="Model version"),
    iou_threshold: float = typer.Option(0.5, "--iou", help="IoU threshold for mAP calculation"),
    confidence: float = typer.Option(0.25, "--confidence", "-c", help="Confidence threshold"),
) -> None:
    """Evaluate a model and get precision/recall/mAP metrics."""
    import json
    from pathlib import Path

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

    dataset_path = Path(dataset)
    if not dataset_path.exists():
        rprint(f"[red]Dataset not found: {dataset}[/red]")
        raise typer.Exit(code=1)

    rprint(f"[bold]Evaluating {model} on {dataset}...[/bold]")

    from openeye_ai.mlops.evaluation import evaluate_model

    try:
        metrics = evaluate_model(
            adapter, dataset_path,
            iou_threshold=iou_threshold,
            confidence_threshold=confidence,
        )
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as e:
        rprint(f"[red]Evaluation failed: {e}[/red]")
        raise typer.Exit(code=1)

    table = Table(title=f"Evaluation Results: {model}")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", justify="right", style="green")

    table.add_row("Precision", f"{metrics.precision:.4f}")
    table.add_row("Recall", f"{metrics.recall:.4f}")
    table.add_row("F1 Score", f"{metrics.f1:.4f}")
    table.add_row("mAP@{:.2f}".format(iou_threshold), f"{metrics.mAP:.4f}")
    table.add_row("Total Images", str(metrics.total_images))
    table.add_row("Total Predictions", str(metrics.total_predictions))
    table.add_row("Total Ground Truth", str(metrics.total_ground_truth))
    if metrics.per_class:
        table.add_row("", "")
        for cls_name, cls_ap in metrics.per_class.items():
            table.add_row(f"  {cls_name} AP", f"{cls_ap:.4f}")

    console.print(table)


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
    model_key: str | None = typer.Option(None, "--model", "-m", help="Filter by model key"),
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
    test_id: str | None = typer.Option(None, "--test", "-t", help="Filter by test ID"),
    model_key: str | None = typer.Option(None, "--model", "-m", help="Filter by model key"),
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
