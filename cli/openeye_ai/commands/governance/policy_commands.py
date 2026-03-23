"""Policy management commands — status, ls, enable, disable, presets, load, validate."""

from __future__ import annotations

import sys
from pathlib import Path

import typer
from rich import print as rprint
from rich.console import Console
from rich.table import Table

from openeye_ai.commands.governance_client import GovernanceClient

# Ensure backend/src is importable for governance.engine
_BACKEND_SRC = str(Path(__file__).resolve().parents[4] / "backend" / "src")
if _BACKEND_SRC not in sys.path:
    sys.path.insert(0, _BACKEND_SRC)

console = Console()


def _get_engine():
    from governance.engine import GovernanceEngine
    return GovernanceEngine()


def _print_status(data: dict) -> None:
    table = Table(title="Governance Status", show_header=False)
    table.add_column("Field", style="cyan")
    table.add_column("Value")

    active = data.get("active", False)
    table.add_row("Active", "[green]Yes[/green]" if active else "[red]No[/red]")
    table.add_row("Config", data.get("config_name", "none"))
    table.add_row("Domain", data.get("domain", "universal"))
    table.add_row("Policies", f"{data.get('enabled_policies', 0)}/{data.get('total_policies', 0)} enabled")
    table.add_row("Evaluations", str(data.get("total_evaluations", 0)))
    table.add_row("Violations", str(data.get("total_violations", 0)))
    table.add_row("Warnings", str(data.get("total_warnings", 0)))
    table.add_row("Fail-open", "Yes" if data.get("fail_open") else "No")

    console.print(table)

    policy_names = data.get("enabled_policy_names", [])
    if policy_names:
        rprint("\n[bold]Active policies:[/bold]")
        for name in policy_names:
            rprint(f"  • {name}")


def status(
    server: str | None = typer.Option(None, "--server", "-s", help="Server URL to query"),
) -> None:
    """Show current governance status."""
    if server:
        _print_status(GovernanceClient(server).get_status())
    else:
        rprint("[dim]No server specified. Showing local engine status.[/dim]")
        engine = _get_engine()
        _print_status(engine.get_status().model_dump())


def ls() -> None:
    """List all available policies (built-in + plugins)."""
    engine = _get_engine()
    available = engine.list_available_types()

    table = Table(title="Available Policies")
    table.add_column("Name", style="cyan")
    table.add_column("Domain", style="yellow")
    table.add_column("Description")
    table.add_column("Plugin", style="dim")

    for p in available:
        table.add_row(
            p.name,
            p.domain.value,
            p.description,
            "Yes" if p.is_plugin else "",
        )

    console.print(table)


def enable(
    name: str = typer.Argument(..., help="Policy name to enable"),
    server: str | None = typer.Option(None, "--server", "-s"),
) -> None:
    """Enable a governance policy."""
    if server:
        GovernanceClient(server).enable_policy(name)
        rprint(f"[green]Enabled policy:[/green] {name}")
    else:
        engine = _get_engine()
        if engine.enable_policy(name):
            rprint(f"[green]Enabled policy:[/green] {name}")
        else:
            rprint(f"[red]Policy not found:[/red] {name}")
            raise typer.Exit(1)


def disable(
    name: str = typer.Argument(..., help="Policy name to disable"),
    server: str | None = typer.Option(None, "--server", "-s"),
) -> None:
    """Disable a governance policy."""
    if server:
        GovernanceClient(server).disable_policy(name)
        rprint(f"[yellow]Disabled policy:[/yellow] {name}")
    else:
        engine = _get_engine()
        if engine.disable_policy(name):
            rprint(f"[yellow]Disabled policy:[/yellow] {name}")
        else:
            rprint(f"[red]Policy not found:[/red] {name}")
            raise typer.Exit(1)


def presets() -> None:
    """List available governance presets."""
    from governance.loader import list_presets

    preset_names = list_presets()
    if not preset_names:
        rprint("[dim]No presets found.[/dim]")
        return

    table = Table(title="Governance Presets")
    table.add_column("Name", style="cyan")

    for name in preset_names:
        table.add_row(name)

    console.print(table)


def load(
    target: str = typer.Argument(..., help="Preset name or path to YAML config"),
    server: str | None = typer.Option(None, "--server", "-s"),
) -> None:
    """Load a preset or custom YAML governance config."""
    if server:
        client = GovernanceClient(server)
        path = Path(target)
        if path.is_file():
            client.load_config_yaml(path.read_text())
            rprint(f"[green]Loaded config from:[/green] {target}")
        else:
            client.load_preset(target)
            rprint(f"[green]Loaded preset:[/green] {target}")
    else:
        # Local validation
        path = Path(target)
        if path.is_file():
            from governance.loader import load_yaml
            try:
                config = load_yaml(path)
                rprint(f"[green]Valid config:[/green] {config.name} ({len(config.policies)} policies)")
            except Exception as e:
                rprint(f"[red]Invalid config:[/red] {e}")
                raise typer.Exit(1)
        else:
            from governance.loader import load_preset as _load_preset
            try:
                config = _load_preset(target)
                rprint(f"[green]Valid preset:[/green] {config.name} ({len(config.policies)} policies)")
            except Exception as e:
                rprint(f"[red]Error:[/red] {e}")
                raise typer.Exit(1)


def validate(
    file: str = typer.Argument(..., help="Path to YAML governance config"),
) -> None:
    """Validate a YAML governance config file."""
    from governance.loader import validate_yaml

    valid, message = validate_yaml(file)
    if valid:
        rprint(f"[green]Valid[/green] — {message}")
    else:
        rprint(f"[red]Invalid[/red] — {message}")
        raise typer.Exit(1)
