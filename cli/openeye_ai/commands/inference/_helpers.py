"""Shared helpers for inference commands."""

from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint

from openeye_ai._cli_helpers import console, dependency_error
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import (
    get_adapter,
    get_model_info,
    get_variant_info,
    is_downloaded,
    is_variant_downloaded,
)


def resolve_model_info(model: str, variant: str | None = None) -> dict:
    """Look up model/variant info from the registry, exit on error."""
    try:
        if variant:
            return get_variant_info(model, variant)
        return get_model_info(model)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)


def resolve_model_dir(model: str, variant: str | None = None) -> Path:
    """Return the model directory, exit if not downloaded."""
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
    return model_dir


def load_adapter(model: str, model_dir: Path, info: dict, *, variant: str | None = None):
    """Create and load an adapter, exit on error."""
    try:
        adapter = get_adapter(model, variant=variant)
    except ImportError as e:
        dependency_error(model, e)

    try:
        with console.status(f"[bold]Loading {info['name']}...[/bold]"):
            adapter.load(model_dir)
    except ImportError as e:
        dependency_error(model, e)
    except Exception as e:
        rprint(f"[red]Failed to load model: {e}[/red]")
        raise typer.Exit(code=1)

    return adapter
