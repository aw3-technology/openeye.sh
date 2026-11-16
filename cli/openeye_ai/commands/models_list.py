from __future__ import annotations

import json

import typer
from rich.table import Table

from openeye_ai._cli_helpers import console
from openeye_ai.registry import (
    is_downloaded,
    is_variant_downloaded,
    load_registry,
)


def list_models(
    as_json: bool = typer.Option(
        False, "--json", help="Print models as JSON (for scripts and agents)"
    ),
) -> None:
    """Show available and downloaded models."""
    from openeye_ai.utils.hardware import format_hardware_tags

    registry = load_registry()
    if as_json:
        models = [
            {
                "key": key,
                "name": info.get("name", key),
                "task": info.get("task"),
                "description": info.get("description"),
                "size_mb": info.get("size_mb"),
                "hardware": info.get("hardware", {"cpu": True}),
                "downloaded": is_downloaded(key),
                "variants": {
                    v: {"downloaded": is_variant_downloaded(key, v)}
                    for v in info.get("variants") or {}
                },
            }
            for key, info in registry.items()
        ]
        typer.echo(json.dumps(models, indent=2))
        return
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
