"""MLOps registry commands — upload, list, versions, promote, lineage."""

from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import console
from openeye_ai.commands.mlops._app import mlops_app


@mlops_app.command("upload")
def mlops_upload(
    file: Path = typer.Argument(help="Path to model file (ONNX, TorchScript, SafeTensors)"),
    name: str = typer.Option(..., "--name", "-n", help="Human-readable model name"),
    key: str = typer.Option(..., "--key", "-k", help="Registry key (slug)"),
    format: str = typer.Option(..., "--format", "-f", help="Model format: onnx, torchscript, safetensors"),
    task: str = typer.Option("detection", "--task", "-t", help="Model task"),
    author: str = typer.Option("", "--author", help="Author name"),
    description: str = typer.Option("", "--description", "-d", help="Model description"),
    adapter: str = typer.Option("onnx_generic", "--adapter", help="Adapter key"),
) -> None:
    """Upload a custom-trained model and register it in the enterprise registry."""
    from openeye_ai.mlops.model_registry import upload_and_register
    from openeye_ai.mlops.schemas import ModelFormat, ModelUploadRequest

    try:
        fmt = ModelFormat(format)
    except ValueError:
        rprint(f"[red]Invalid format '{format}'. Use: onnx, torchscript, safetensors[/red]")
        raise typer.Exit(code=1)

    try:
        req = ModelUploadRequest(
            name=name, key=key, format=fmt, task=task,
            description=description, author=author,
            file_path=str(file), adapter=adapter,
        )
        version = upload_and_register(req)
        rprint(f"[green]Registered '{name}' as '{key}' v{version.version}[/green]")
        rprint(f"  Format: {version.format.value} | Size: {version.file_size_mb:.1f} MB")
    except (FileNotFoundError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@mlops_app.command("registry")
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
            latest.version if latest else "—",
            prod.version if prod else "—",
        )
    console.print(table)


@mlops_app.command("versions")
def mlops_versions(
    model_key: str = typer.Argument(help="Model registry key"),
) -> None:
    """List all versions of a model with metadata."""
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
        acc = f"{v.training_metrics.accuracy:.1%}" if v.training_metrics.accuracy else "—"
        table.add_row(
            v.version, v.stage.value, v.format.value,
            f"{v.file_size_mb:.1f} MB", v.author or "—",
            v.training_dataset or "—", acc,
            v.created_at[:10],
        )
    console.print(table)


@mlops_app.command("promote")
def mlops_promote(
    model_key: str = typer.Argument(help="Model key"),
    version: str = typer.Argument(help="Version to promote"),
    stage: str = typer.Argument(help="Target stage: staging or production"),
    requester: str = typer.Option("cli-user", "--requester", help="Requester name"),
    reason: str = typer.Option("", "--reason", help="Reason for promotion"),
) -> None:
    """Promote a model version to a new stage (dev -> staging -> production)."""
    from openeye_ai.mlops.lifecycle import request_promotion
    from openeye_ai.mlops.schemas import ModelStage, PromotionRequest

    try:
        target = ModelStage(stage)
    except ValueError:
        rprint(f"[red]Invalid stage '{stage}'. Use: staging, production, archived[/red]")
        raise typer.Exit(code=1)

    try:
        req = PromotionRequest(
            model_key=model_key, version=version,
            target_stage=target, requester=requester, reason=reason,
        )
        record = request_promotion(req)
        rprint(f"[green]Promotion {record.from_stage.value} -> {record.to_stage.value}: {record.status.value}[/green]")
        if record.approver:
            rprint(f"  Approved by: {record.approver}")
    except (KeyError, ValueError) as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


@mlops_app.command("lineage")
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

    for i, lineage in enumerate(chain):
        indent = "    " * i
        rprint(f"{indent}[cyan]{lineage.model_key}[/cyan] v{lineage.version}")
        rprint(f"{indent}    Dataset: {lineage.dataset} ({lineage.dataset_size or '?'} samples)")
        rprint(f"{indent}    Commit: {lineage.code_commit[:8] if lineage.code_commit else '—'}")
        rprint(f"{indent}    Framework: {lineage.training_framework or '—'}")
        if lineage.hyperparameters:
            hp = ", ".join(f"{k}={v}" for k, v in lineage.hyperparameters.items())
            rprint(f"{indent}    Hyperparams: {hp}")
