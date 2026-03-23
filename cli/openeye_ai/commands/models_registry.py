from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint

from openeye_ai.registry import add_model_to_registry


def add_model(
    key: str = typer.Argument(help="Registry key (e.g. my-model)"),
    name: str | None = typer.Option(None, "--name", help="Display name (defaults to key)"),
    task: str = typer.Option(..., "--task", help="Task type (detection, depth, segmentation, classification, embedding)"),
    adapter: str = typer.Option(..., "--adapter", help="Adapter key or path to .py file"),
    hf_repo: str | None = typer.Option(None, "--hf-repo", help="HuggingFace repo ID"),
    filename: str | None = typer.Option(None, "--filename", help="Model filename"),
    size_mb: float | None = typer.Option(None, "--size-mb", help="Model size in MB"),
    description: str = typer.Option("", "--description", help="Model description"),
) -> None:
    """Add a new model to the registry."""
    entry: dict = {
        "name": name or key,
        "task": task,
        "adapter": adapter,
        "description": description,
    }
    if hf_repo:
        entry["hf_repo"] = hf_repo
    if filename:
        entry["filename"] = filename
    if size_mb is not None:
        entry["size_mb"] = size_mb

    try:
        add_model_to_registry(key, entry)
    except Exception as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    rprint(f"[green]Added '{key}' to registry.[/green]")


def register_adapter(
    key: str = typer.Argument(help="Registry key for the model (e.g. my-custom-model)"),
    adapter_path: str = typer.Argument(help="Path to adapter .py file"),
    name: str = typer.Option(..., "--name", help="Display name"),
    task: str = typer.Option(..., "--task", help="Task type"),
    description: str = typer.Option("", "--description", help="Model description"),
) -> None:
    """Register a custom adapter and add it to the registry."""
    from openeye_ai.utils.custom_adapter import load_custom_adapter

    adapter_file = Path(adapter_path).resolve()
    try:
        load_custom_adapter(adapter_file)
    except Exception as e:
        rprint(f"[red]Failed to load adapter: {e}[/red]")
        raise typer.Exit(code=1)

    entry: dict = {
        "name": name,
        "task": task,
        "adapter": str(adapter_file),
        "description": description,
    }

    try:
        add_model_to_registry(key, entry)
    except Exception as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    rprint(f"[green]Registered custom adapter '{key}' from {adapter_file}[/green]")


def update_registry() -> None:
    """Fetch the remote registry and merge new models."""
    from openeye_ai.registry import _REGISTRY_PATH
    from openeye_ai.utils.registry_update import update_registry_from_remote

    try:
        added = update_registry_from_remote(_REGISTRY_PATH)
    except Exception as e:
        rprint(f"[red]Registry update failed: {e}[/red]")
        raise typer.Exit(code=1)

    if added:
        rprint(f"[green]Added {len(added)} new model(s): {', '.join(added)}[/green]")
    else:
        rprint("[green]Registry is up to date.[/green]")
