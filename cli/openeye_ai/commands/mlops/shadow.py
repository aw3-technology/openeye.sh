"""Shadow mode sub-commands — create shadow deployment, view status."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console


def mlops_shadow_mode(
    champion: str = typer.Option(..., "--champion", help="Production (champion) version"),
    challenger: str = typer.Option(..., "--challenger", help="Shadow (challenger) version"),
    model: str | None = typer.Option(None, "--model", "-m", help="Model key (auto-detected from champion)"),
    sample_rate: float = typer.Option(1.0, "--sample-rate", help="Fraction of traffic to shadow (0-1)"),
    max_samples: int | None = typer.Option(None, "--max-samples", help="Stop after N samples"),
) -> None:
    """Test a new model in shadow mode without affecting production."""
    from openeye_ai.mlops.shadow_mode import create_shadow_deployment
    from openeye_ai.mlops.schemas import ShadowDeploymentConfig

    # Auto-detect model key
    model_key = model or (champion.rsplit("-v", 1)[0] if "-v" in champion else champion)

    config = ShadowDeploymentConfig(
        name=f"shadow-{model_key}-{challenger}",
        model_key=model_key,
        production_version=champion,
        shadow_version=challenger,
        sample_rate=sample_rate,
        max_samples=max_samples,
    )
    dep = create_shadow_deployment(config)
    rprint(f"[green]Shadow deployment created: {dep.id}[/green]")
    rprint(f"  Champion: {champion} | Challenger: {challenger} (shadow) | Rate: {sample_rate:.0%}")


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
    table.add_column("Champion")
    table.add_column("Challenger")
    table.add_column("Status", style="magenta")
    table.add_column("Samples", justify="right")
    table.add_column("Agreement", justify="right")
    table.add_column("Champ Lat", justify="right")
    table.add_column("Chall Lat", justify="right")

    for d in deps:
        c = d.comparison
        table.add_row(
            d.id, d.config.model_key,
            d.config.production_version, d.config.shadow_version,
            d.status.value, str(c.total_samples),
            f"{c.agreement_rate:.1%}" if c.total_samples else "\u2014",
            f"{c.production_mean_latency_ms:.1f}ms" if c.total_samples else "\u2014",
            f"{c.shadow_mean_latency_ms:.1f}ms" if c.total_samples else "\u2014",
        )
    console.print(table)
