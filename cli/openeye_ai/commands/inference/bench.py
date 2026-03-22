"""Bench command — model inference benchmarking."""

from __future__ import annotations


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

    title = f"Benchmark: {info['name']}"
    if variant:
        title += f" ({variant})"

    table = Table(title=title)
    table.add_column("Metric", style="cyan")
    table.add_column("Value", justify="right", style="bold")

    # Latency stats
    table.add_row("Mean", f"{result.mean_ms:.2f} ms")
    table.add_row("Median", f"{result.median_ms:.2f} ms")
    table.add_row("Std Dev", f"{result.std_ms:.2f} ms")
    table.add_row("Min", f"{result.min_ms:.2f} ms")
    table.add_row("Max", f"{result.max_ms:.2f} ms")
    table.add_row("P95", f"{result.p95_ms:.2f} ms")
    table.add_row("FPS", f"{result.fps:.1f}")

    # Run config
    table.add_section()
    table.add_row("Runs", str(result.runs))
    table.add_row("Warmup", str(result.warmup))
    table.add_row("Image Size", f"{width}x{height}")

    # Hardware info
    hw = result.hardware
    if hw:
        table.add_section()
        table.add_row("Device", hw.get("device", "unknown"))
        table.add_row("CPU", hw.get("cpu", "unknown"))
        if "gpu" in hw:
            table.add_row("GPU", hw["gpu"])
        table.add_row("Platform", hw.get("platform", "unknown"))

    console.print(table)
