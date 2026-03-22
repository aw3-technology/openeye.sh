"""Model management commands — list, pull, remove, add-model, register-adapter, update-registry."""

from __future__ import annotations

import shutil
from pathlib import Path

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import _EXTRAS, _install_hint, console
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import (
    add_model_to_registry,
    get_adapter,
    get_model_info,
    get_variant_info,
    is_downloaded,
    is_variant_downloaded,
    load_registry,
)


# ── list ──────────────────────────────────────────────────────────────


def list_models() -> None:
    """Show available and downloaded models."""
    from openeye_ai.utils.hardware import format_hardware_tags

    registry = load_registry()
    table = Table(title="OpenEye Models")
    table.add_column("Model", style="cyan", no_wrap=True)
    table.add_column("Task", style="magenta")
    table.add_column("Description")
    table.add_column("Size", justify="right")
    table.add_column("Hardware")
    table.add_column("Variants")
    table.add_column("Status", style="green")

    for key, info in registry.items():
        status = "downloaded" if is_downloaded(key) else "available"
        style = "bold green" if status == "downloaded" else "dim"

        hw = info.get("hardware", {"cpu": True})
        hw_str = format_hardware_tags(hw)

        size_mb = info.get("size_mb")
        size_str = f"{size_mb} MB" if size_mb is not None else "[dim]—[/dim]"

        variants = info.get("variants") or {}
        variant_names = []
        for vname in variants:
            if is_variant_downloaded(key, vname):
                variant_names.append(f"[green]{vname}[/green]")
            else:
                variant_names.append(f"[dim]{vname}[/dim]")
        variant_str = ", ".join(variant_names) if variant_names else "[dim]—[/dim]"

        table.add_row(
            key,
            info["task"],
            info["description"],
            size_str,
            hw_str,
            variant_str,
            f"[{style}]{status}[/{style}]",
        )
    console.print(table)


# ── pull ──────────────────────────────────────────────────────────────


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


# ── remove ────────────────────────────────────────────────────────────


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


# ── add-model ─────────────────────────────────────────────────────────


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


# ── register-adapter ──────────────────────────────────────────────────


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


# ── update-registry ───────────────────────────────────────────────────


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
