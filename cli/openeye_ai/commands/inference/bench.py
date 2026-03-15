"""``openeye bench`` — model benchmarking."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console
from openeye_ai.commands.inference._helpers import load_adapter, resolve_model_dir, resolve_model_info

def bench(
    model: str = typer.Argument(help="Model name to benchmark"),
    variant: str | None = typer.Option(None, "--variant", help="Variant to benchmark"),
    warmup: int = typer.Option(3, "--warmup", help="Number of warmup runs"),
    runs: int = typer.Option(10, "--runs", help="Number of timed runs"),
    width: int = typer.Option(640, "--width", help="Test image width"),
    height: int = typer.Option(480, "--height", help="Test image height"),
) -> None:
    """Benchmark a model's inference speed."""
    if warmup < 0 or runs < 1 or width < 1 or height < 1:
        rprint("[red]Invalid benchmark parameters: warmup >= 0, runs/width/height >= 1[/red]")
        raise typer.Exit(code=1)

    from openeye_ai.utils.benchmark import run_benchmark

    info = resolve_model_info(model, variant)
    model_dir = resolve_model_dir(model, variant)
    adapter = load_adapter(model, model_dir, info, variant=variant)

    rprint(f"[bold]Benchmarking {info['name']} ({warmup} warmup, {runs} runs, {width}x{height})...[/bold]")
    try:
        result = run_benchmark(
            adapter,
            model_name=model,
            variant=variant,
            warmup=warmup,
            runs=runs,
            width=width,
            height=height,
        )
    except Exception as e:
        rprint(f"[red]Benchmark failed: {e}[/red]")
        raise typer.Exit(code=1)

    table = Table(title=f"Benchmark: {info['name']}")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", justify="right", style="bold")
    table.add_row("Mean", f"{result.mean_ms:.2f} ms")
    table.add_row("Median", f"{result.median_ms:.2f} ms")
    table.add_row("P95", f"{result.p95_ms:.2f} ms")
    table.add_row("FPS", f"{result.fps:.1f}")
    table.add_row("Runs", str(result.runs))
    table.add_row("Image Size", f"{width}x{height}")
    if variant:
        table.add_row("Variant", variant)
    console.print(table)
