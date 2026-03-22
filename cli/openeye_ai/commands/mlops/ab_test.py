"""A/B testing sub-commands — create, list, complete."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console


def mlops_create_ab_test(
    champion: str = typer.Option(..., "--champion", help="Champion (control) model version, e.g. yolov8-v2"),
    challenger: str = typer.Option(..., "--challenger", help="Challenger model version, e.g. yolov8-v3"),
    traffic: str = typer.Option("50/50", "--traffic", help="Traffic split champion/challenger, e.g. 80/20"),
    name: str = typer.Option("", "--name", help="Test name"),
    model: str | None = typer.Option(None, "--model", "-m", help="Model key (auto-detected from champion)"),
    max_samples: int | None = typer.Option(None, "--max-samples", help="Stop after N samples"),
) -> None:
    """Create an A/B test between two model versions."""
    from openeye_ai.mlops.ab_testing import create_ab_test
    from openeye_ai.mlops.schemas import ABTestConfig

    # Parse traffic split, e.g. "80/20"
    try:
        parts = traffic.split("/")
        champion_pct = int(parts[0])
        challenger_pct = int(parts[1])
        split = challenger_pct / (champion_pct + challenger_pct)
    except (ValueError, IndexError, ZeroDivisionError):
        rprint(f"[red]Invalid traffic split '{traffic}'. Use format like 80/20.[/red]")
        raise typer.Exit(code=1)

    # Auto-detect model key from champion string (e.g. "yolov8-v2" -> "yolov8")
    model_key = model or (champion.rsplit("-v", 1)[0] if "-v" in champion else champion)

    config = ABTestConfig(
        name=name or f"{model_key} A/B: {champion} vs {challenger}",
        model_key=model_key,
        version_a=champion,
        version_b=challenger,
        traffic_split=split,
        max_samples=max_samples,
    )
    test = create_ab_test(config)
    rprint(f"[green]A/B test created: {test.id}[/green]")
    rprint(f"  Champion: {champion} ({champion_pct}%) vs Challenger: {challenger} ({challenger_pct}%)")


def mlops_ab_tests(model_key: str | None = typer.Argument(None, help="Filter by model key")) -> None:
    """Show running A/B tests and their metrics."""
    from openeye_ai.mlops.ab_testing import list_ab_tests

    tests = list_ab_tests(model_key)
    if not tests:
        rprint("[dim]No A/B tests found.[/dim]")
        return

    table = Table(title="A/B Tests")
    table.add_column("ID", style="cyan")
    table.add_column("Model")
    table.add_column("Champion")
    table.add_column("Challenger")
    table.add_column("Status", style="magenta")
    table.add_column("Champ Acc", justify="right")
    table.add_column("Chall Acc", justify="right")
    table.add_column("Champ Lat", justify="right")
    table.add_column("Chall Lat", justify="right")
    table.add_column("Winner", style="green")

    for t in tests:
        table.add_row(
            t.id, t.config.model_key,
            t.config.version_a, t.config.version_b,
            t.status.value,
            f"{t.metrics_a.mean_accuracy:.1%}" if t.metrics_a.samples else "\u2014",
            f"{t.metrics_b.mean_accuracy:.1%}" if t.metrics_b.samples else "\u2014",
            f"{t.metrics_a.mean_latency_ms:.1f}ms" if t.metrics_a.samples else "\u2014",
            f"{t.metrics_b.mean_latency_ms:.1f}ms" if t.metrics_b.samples else "\u2014",
            t.winner or "\u2014",
        )
    console.print(table)


def mlops_complete_ab_test(
    test_id: str = typer.Argument(help="A/B test ID to complete"),
) -> None:
    """Complete an A/B test and graduate the winner."""
    from openeye_ai.mlops.ab_testing import complete_ab_test

    try:
        test = complete_ab_test(test_id)
        rprint(f"[green]A/B test completed: {test.id}[/green]")
        rprint(f"  Champion: {test.config.version_a} | Challenger: {test.config.version_b}")
        if test.winner:
            rprint(f"  [bold green]Winner: {test.winner}[/bold green]")
        else:
            rprint("  [yellow]No clear winner.[/yellow]")
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)
