"""Bench command — model inference benchmarking."""

from __future__ import annotations

from typing import Optional

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console, dependency_error
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import (
    get_adapter,
    get_model_info,
    get_variant_info,
    is_downloaded,
    is_variant_downloaded,
)


def bench(
    model: str = typer.Argument(help="Model name to benchmark"),
    variant: Optional[str] = typer.Option(None, "--variant", help="Variant to benchmark"),
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

    try:
        if variant:
            info = get_variant_info(model, variant)
        else:
            info = get_model_info(model)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    if variant:
        model_dir = MODELS_DIR / model / f".variant-{variant}"
        if not is_variant_downloaded(model, variant):
            rprint(f"[yellow]Variant '{variant}' not downloaded. Run: openeye pull {model} --variant {variant}[/yellow]")
            raise typer.Exit(code=1)
    else:
        model_dir = MODELS_DIR / model
        if not is_downloaded(model):
            rprint(f"[yellow]Model '{model}' not downloaded. Run: openeye pull {model}[/yellow]")
            raise typer.Exit(code=1)

    try:
        adapter = get_adapter(model, variant=variant)
    except ImportError as e:
        dependency_error(model, e)

    rprint(f"[bold]Loading {info['name']}...[/bold]")
    try:
        adapter.load(model_dir)
    except ImportError as e:
        dependency_error(model, e)
    except Exception as e:
        rprint(f"[red]Failed to load model: {e}[/red]")
        raise typer.Exit(code=1)

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
