"""Registry sub-commands — upload, list registry, list versions."""

from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console


def mlops_upload(
    file: Path = typer.Argument(help="Path to model file (ONNX, TorchScript, SafeTensors, PyTorch)"),
    name: str | None = typer.Option(None, "--name", "-n", help="Human-readable model name (default: filename stem)"),
    key: str | None = typer.Option(None, "--key", "-k", help="Registry key / slug (default: filename stem, lowered)"),
    format: str | None = typer.Option(None, "--format", "-f", help="Model format: onnx, torchscript, safetensors, pytorch (auto-detected if omitted)"),
    task: str = typer.Option("detection", "--task", "-t", help="Model task"),
    author: str = typer.Option("", "--author", help="Author name"),
    description: str = typer.Option("", "--description", "-d", help="Model description"),
    adapter: str = typer.Option("onnx_generic", "--adapter", help="Adapter key"),
) -> None:
    """Upload a custom-trained model and register it in the enterprise registry."""
    from openeye_ai.mlops.model_registry import upload_and_register
    from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

    # Auto-infer name/key from filename
    stem = file.stem.replace("_", "-").replace(" ", "-")
    resolved_name = name or stem
    resolved_key = key or stem.lower()

    # Auto-detect format from extension
    if format:
        try:
            fmt = ModelFormat(format)
        except ValueError:
            rprint(f"[red]Invalid format '{format}'. Use: onnx, torchscript, safetensors, pytorch[/red]")
            raise typer.Exit(code=1)
    else:
        ext_map = {
            ".onnx": ModelFormat.ONNX,
            ".pt": ModelFormat.PYTORCH,
            ".pth": ModelFormat.PYTORCH,
            ".safetensors": ModelFormat.SAFETENSORS,
            ".engine": ModelFormat.TENSORRT,
            ".trt": ModelFormat.TENSORRT,
            ".mlmodel": ModelFormat.COREML,
        }
        fmt = ext_map.get(file.suffix.lower())
        if fmt is None:
            rprint(f"[red]Cannot auto-detect format from '{file.suffix}'. Use --format.[/red]")
            raise typer.Exit(code=1)

    try:
        req = ModelUploadRequest(
            name=resolved_name, key=resolved_key, format=fmt, task=task,
            description=description, author=author,
            file_path=str(file), adapter=adapter,
        )
        version = upload_and_register(req)
        rprint(f"[green]Registered '{resolved_name}' as '{resolved_key}' v{version.version}[/green]")
        rprint(f"  Format: {version.format.value} | Size: {version.file_size_mb:.1f} MB")
    except (FileNotFoundError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


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
            latest.version if latest else "\u2014",
            prod.version if prod else "\u2014",
        )
    console.print(table)


def mlops_versions(
    model_key: str = typer.Argument(help="Model registry key"),
) -> None:
    """List all versions of a model with their stage (dev/staging/prod)."""
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
        acc = f"{v.training_metrics.accuracy:.1%}" if v.training_metrics.accuracy else "\u2014"
        table.add_row(
            v.version, v.stage.value, v.format.value,
            f"{v.file_size_mb:.1f} MB", v.author or "\u2014",
            v.training_dataset or "\u2014", acc,
            v.created_at[:10],
        )
    console.print(table)
