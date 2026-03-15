"""MLOps testing commands — A/B tests, shadow mode, validation, benchmark."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console, dependency_error
from openeye_ai.commands.mlops._app import mlops_app
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import get_adapter, is_downloaded

@mlops_app.command("ab-test")
def mlops_ab_test(
    model_key: str = typer.Argument(help="Model key"),
    version_a: str = typer.Option(..., "--a", help="Control version"),
    version_b: str = typer.Option(..., "--b", help="Challenger version"),
    name: str = typer.Option("", "--name", help="Test name"),
    split: float = typer.Option(0.5, "--split", help="Traffic split to version B (0-1)"),
    max_samples: int | None = typer.Option(None, "--max-samples", help="Stop after N samples"),
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
def mlops_ab_status(model_key: str | None = typer.Argument(None, help="Filter by model key")) -> None:
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

@mlops_app.command("shadow")
def mlops_shadow(
    model_key: str = typer.Argument(help="Model key"),
    prod_version: str = typer.Option(..., "--prod", help="Production version"),
    shadow_version: str = typer.Option(..., "--shadow", help="Shadow version"),
    sample_rate: float = typer.Option(1.0, "--sample-rate", help="Fraction of traffic (0-1)"),
    max_samples: int | None = typer.Option(None, "--max-samples", help="Stop after N samples"),
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
def mlops_shadow_status(model_key: str | None = typer.Argument(None, help="Filter by model")) -> None:
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
