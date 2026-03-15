"""Configuration commands — config get/set."""

from __future__ import annotations

import typer
from rich import print as rprint

config_app = typer.Typer(help="Get and set configuration values.")


@config_app.command("set")
def config_set(
    key: str = typer.Argument(help="Config key (e.g. default-device)"),
    value: str = typer.Argument(help="Config value (e.g. gpu)"),
) -> None:
    """Set a configuration value."""
    from openeye_ai.config import set_config_value

    set_config_value(key, value)
    rprint(f"[green]Set '{key}' = '{value}'[/green]")


@config_app.command("get")
def config_get(
    key: str = typer.Argument(help="Config key to read"),
) -> None:
    """Get a configuration value."""
    from openeye_ai.config import get_config_value

    val = get_config_value(key)
    if val is None:
        rprint(f"[yellow]'{key}' is not set.[/yellow]")
        raise typer.Exit(code=1)
    rprint(f"{key} = {val}")
