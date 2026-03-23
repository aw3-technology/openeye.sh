from __future__ import annotations

import shutil

import typer
from rich import print as rprint

from openeye_ai._cli_helpers import _EXTRAS, _install_hint
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import (
    get_adapter,
    get_model_info,
    get_variant_info,
    is_downloaded,
    is_variant_downloaded,
    load_registry,
)


def _pull_single(
    model: str,
    *,
    variant: str | None = None,
    force: bool = False,
) -> bool:
    """Pull a single model (or variant). Returns True on success, False on failure."""
    try:
        if variant:
            info = get_variant_info(model, variant)
        else:
            info = get_model_info(model)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        return False

    if variant:
        model_dir = MODELS_DIR / model / f".variant-{variant}"
        already = is_variant_downloaded(model, variant)
        display_name = f"{info['name']} ({variant})"
    else:
        model_dir = MODELS_DIR / model
        already = is_downloaded(model)
        display_name = info["name"]

    if already and not force:
        rprint(f"[yellow]Model '{display_name}' is already downloaded.[/yellow]")
        return True

    if force and model_dir.exists():
        rprint(f"[yellow]Force re-downloading {display_name}...[/yellow]")
        shutil.rmtree(model_dir, ignore_errors=True)

    if model_dir.exists() and not (model_dir / ".pulled").exists():
        rprint(f"[cyan]Resuming download of {display_name}...[/cyan]")
    else:
        rprint(f"[bold]Pulling {display_name}...[/bold]")

    # Check available disk space before downloading
    expected_size_mb = info.get("size_mb", 0)
    if expected_size_mb:
        disk_usage = shutil.disk_usage(MODELS_DIR)
        free_mb = disk_usage.free / (1024 * 1024)
        # Require at least 2x model size as buffer for extraction/temp files
        required_mb = expected_size_mb * 2
        if free_mb < required_mb:
            rprint(
                f"[red]Insufficient disk space. "
                f"Need ~{required_mb:.0f} MB but only {free_mb:.0f} MB available.[/red]"
            )
            return False

    try:
        adapter = get_adapter(model, variant=variant)
        adapter.pull(model_dir)
    except ImportError as e:
        extra = _EXTRAS.get(model, model)
        rprint(
            f"[red]Missing dependencies for '{model}': {e.name or e}[/red]\n"
            + _install_hint(extra)
        )
        return False
    except Exception as e:
        rprint(f"[red]Download failed for '{display_name}': {e}[/red]")
        return False

    filename = info.get("filename")
    checksum_info = info.get("checksum")
    if filename and checksum_info:
        from openeye_ai.utils.checksum import verify_checksum

        if not verify_checksum(model_dir, filename, checksum_info):
            rprint("[red]Checksum verification failed. Re-run with --force to re-download.[/red]")
            return False

    from openeye_ai.utils.download import mark_pulled

    mark_pulled(model_dir)
    rprint(f"[green]Successfully pulled {display_name}.[/green]")
    return True


def pull(
    model: str | None = typer.Argument(None, help="Model name to download (e.g. yolov8)"),
    all_models: bool = typer.Option(False, "--all", help="Pull all models in the registry"),
    variant: str | None = typer.Option(None, "--variant", help="Pull a specific variant"),
    quantized: bool = typer.Option(False, "--quantized", help="Pull the quantized variant (shortcut for --variant quantized)"),
    force: bool = typer.Option(False, "--force", help="Force re-download even if already pulled"),
) -> None:
    """Download model weights to ~/.openeye/models/."""
    if quantized and variant:
        rprint("[red]Cannot use both --quantized and --variant. Use one or the other.[/red]")
        raise typer.Exit(code=1)
    effective_variant = "quantized" if quantized else variant

    if all_models:
        registry = load_registry()
        failed = []
        for key in registry:
            if effective_variant:
                model_variants = registry[key].get("variants") or {}
                if effective_variant not in model_variants:
                    continue
            if not _pull_single(key, variant=effective_variant, force=force):
                failed.append(key)
        if failed:
            rprint(f"[red]Failed to pull: {', '.join(failed)}[/red]")
            raise typer.Exit(code=1)
        rprint("[green]All models pulled successfully.[/green]")
        return

    if model is None:
        rprint("[red]Provide a model name or use --all.[/red]")
        raise typer.Exit(code=1)

    if not _pull_single(model, variant=effective_variant, force=force):
        raise typer.Exit(code=1)
