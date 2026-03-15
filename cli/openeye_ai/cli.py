"""OpenEye CLI — Ollama for vision AI models."""

from __future__ import annotations

from typing import Optional

import typer
from rich import print as rprint

from openeye_ai import __version__
from openeye_ai.config import ensure_dirs

app = typer.Typer(
    name="openeye",
    help="Ollama for vision AI models. Pull, run, and serve computer-vision models from your terminal.",
    add_completion=False,
    no_args_is_help=True,
)


def version_callback(value: bool) -> None:
    if value:
        rprint(f"[bold]openeye-ai[/bold] v{__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: Optional[bool] = typer.Option(
        None, "--version", "-v", help="Show version.", callback=version_callback, is_eager=True
    ),
) -> None:
    """OpenEye — Ollama for vision AI models."""
    ensure_dirs()


# ── Model management commands ─────────────────────────────────────────

from openeye_ai.commands.models import (
    add_model,
    list_models,
    pull,
    register_adapter,
    remove,
    update_registry,
)

app.command("list")(list_models)
app.command()(pull)
app.command()(remove)
app.command("add-model")(add_model)
app.command("register-adapter")(register_adapter)
app.command("update-registry")(update_registry)

# ── Inference commands ────────────────────────────────────────────────

from openeye_ai.commands.inference import bench, run, serve, watch

app.command()(run)
app.command()(bench)
app.command()(serve)
app.command()(watch)

# ── Demo commands ─────────────────────────────────────────────────────

from openeye_ai.commands.demo import g1_demo

app.command("g1-demo")(g1_demo)

# ── Config subcommands ────────────────────────────────────────────────

from openeye_ai.commands.config import config_app

app.add_typer(config_app, name="config")

# ── Fleet subcommands ─────────────────────────────────────────────────

from openeye_ai.fleet_cli import fleet_app

app.add_typer(fleet_app, name="fleet")

# ── MLOps subcommands ─────────────────────────────────────────────────

from openeye_ai.commands.mlops import mlops_app

app.add_typer(mlops_app, name="mlops")

# ── Governance subcommands ───────────────────────────────────────────

from openeye_ai.commands.governance import govern_app

app.add_typer(govern_app, name="govern")

# ── Agent subcommands ────────────────────────────────────────────────

from openeye_ai.commands.agent_cli import agent_app

app.add_typer(agent_app, name="agent")

# ── Hosted API subcommands ───────────────────────────────────────────

from openeye_ai.commands.api_cli import api_app

app.add_typer(api_app, name="api")

# ── Server utility commands ──────────────────────────────────────────

from openeye_ai.commands.server_cli import health, nebius_stats, server_config_get, server_config_set

app.command("health")(health)
app.command("nebius-stats")(nebius_stats)
app.command("server-config-get")(server_config_get)
app.command("server-config-set")(server_config_set)
