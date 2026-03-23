from __future__ import annotations

import shutil

import typer
from rich import print as rprint

from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import get_model_info, is_downloaded


def remove(model: str = typer.Argument(help="Model name to remove")) -> None:
    """Delete downloaded model weights from ~/.openeye/models/."""
    try:
        get_model_info(model)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    model_dir = MODELS_DIR / model

    if not is_downloaded(model):
        rprint(f"[yellow]Model '{model}' is not downloaded.[/yellow]")
        raise typer.Exit()

    total = sum(f.stat().st_size for f in model_dir.rglob("*") if f.is_file())
    size_mb = total / (1024 * 1024)

    confirmed = typer.confirm(f"Remove '{model}' ({size_mb:.1f} MB)?")
    if not confirmed:
        rprint("[dim]Cancelled.[/dim]")
        raise typer.Exit()

    try:
        shutil.rmtree(model_dir)
    except OSError as e:
        rprint(f"[red]Failed to remove '{model}': {e}[/red]")
        raise typer.Exit(code=1)
    rprint(f"[green]Removed '{model}' ({size_mb:.1f} MB freed).[/green]")
