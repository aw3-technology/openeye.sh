"""Export and lineage sub-commands — export, list exports, lineage."""

from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console


def mlops_export(
    model_key: str = typer.Argument(help="Model key"),
    format: str = typer.Option(..., "--format", "-f", help="Export format: onnx, tensorrt, coreml"),
    version: str = typer.Option("latest", "--version", "-v", help="Model version (default: latest)"),
    output: Path | None = typer.Option(None, "--output", "-o", help="Output path"),
    quantize: bool = typer.Option(False, "--quantize", help="Apply INT8 quantization"),
) -> None:
    """Export a model to ONNX, TensorRT, or CoreML format for deployment."""
    from openeye_ai.mlops.export import export_model
    from openeye_ai.mlops.model_registry import get_registered_model
    from openeye_ai.mlops.schemas import ExportFormat, ExportRequest

    try:
        fmt = ExportFormat(format)
    except ValueError:
        rprint(f"[red]Invalid format '{format}'. Use: onnx, tensorrt, coreml[/red]")
        raise typer.Exit(code=1)

    # Resolve "latest" version
    resolved_version = version
    if version == "latest":
        try:
            entry = get_registered_model(model_key)
            if entry.latest_version:
                resolved_version = entry.latest_version.version
            else:
                rprint(f"[red]No versions found for '{model_key}'.[/red]")
                raise typer.Exit(code=1)
        except KeyError as e:
            rprint(f"[red]{e}[/red]")
            raise typer.Exit(code=1)

    request = ExportRequest(
        model_key=model_key,
        model_version=resolved_version,
        target_format=fmt,
        output_path=str(output) if output else None,
        quantize=quantize,
    )

    try:
        with console.status(f"Exporting {model_key} v{resolved_version} to {format}..."):
            result = export_model(request)
        rprint(f"[green]Exported to: {result.output_path}[/green]")
        rprint(f"  Size: {result.output_size_mb:.1f} MB | Duration: {result.export_duration_seconds:.1f}s")
    except (FileNotFoundError, ValueError, NotImplementedError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


def mlops_exports(
    model_key: str | None = typer.Option(None, "--model", "-m", help="Filter by model key"),
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

    dash = "\u2014"
    for i, lineage in enumerate(chain):
        indent = "    " * i
        rprint(f"{indent}[cyan]{lineage.model_key}[/cyan] v{lineage.version}")
        rprint(f"{indent}    Dataset: {lineage.dataset} ({lineage.dataset_size or '?'} samples)")
        commit = lineage.code_commit[:8] if lineage.code_commit else dash
        rprint(f"{indent}    Commit: {commit}")
        framework = lineage.training_framework or dash
        rprint(f"{indent}    Framework: {framework}")
        if lineage.hyperparameters:
            hp = ", ".join(f"{k}={v}" for k, v in lineage.hyperparameters.items())
            rprint(f"{indent}    Hyperparams: {hp}")
