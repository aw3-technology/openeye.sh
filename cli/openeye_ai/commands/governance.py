"""CLI commands for OpenEye Govern — `openeye govern`."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.console import Console
from rich.table import Table

from openeye_ai._backend import ensure_backend_path

ensure_backend_path()

console = Console()

govern_app = typer.Typer(
    name="govern",
    help="Visual governance layer — manage policies, presets, and audit trail.",
    no_args_is_help=True,
)

def _get_engine():
    from governance.engine import GovernanceEngine
    return GovernanceEngine()

@govern_app.command("status")
def status(
    server: str | None = typer.Option(None, "--server", "-s", help="Server URL to query"),
):
    """Show current governance status."""
    if server:
        import httpx
        try:
            r = httpx.get(f"{server}/governance/status", timeout=5)
            r.raise_for_status()
            data = r.json()
            _print_status(data)
        except Exception as e:
            rprint(f"[red]Error:[/red] {e}")
            raise typer.Exit(1)
    else:
        rprint("[dim]No server specified. Showing local engine status.[/dim]")
        engine = _get_engine()
        _print_status(engine.get_status().model_dump())

def _print_status(data: dict):
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

@govern_app.command("ls")
def ls():
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

@govern_app.command("enable")
def enable(
    name: str = typer.Argument(..., help="Policy name to enable"),
    server: str | None = typer.Option(None, "--server", "-s"),
):
    """Enable a governance policy."""
    if server:
        import httpx
        try:
            r = httpx.post(f"{server}/governance/policies/{name}/enable", timeout=5)
            r.raise_for_status()
            rprint(f"[green]Enabled policy:[/green] {name}")
        except Exception as e:
            rprint(f"[red]Error:[/red] {e}")
            raise typer.Exit(1)
    else:
        rprint("[yellow]Use --server to enable policies on a running server.[/yellow]")

@govern_app.command("disable")
def disable(
    name: str = typer.Argument(..., help="Policy name to disable"),
    server: str | None = typer.Option(None, "--server", "-s"),
):
    """Disable a governance policy."""
    if server:
        import httpx
        try:
            r = httpx.post(f"{server}/governance/policies/{name}/disable", timeout=5)
            r.raise_for_status()
            rprint(f"[yellow]Disabled policy:[/yellow] {name}")
        except Exception as e:
            rprint(f"[red]Error:[/red] {e}")
            raise typer.Exit(1)
    else:
        rprint("[yellow]Use --server to disable policies on a running server.[/yellow]")

@govern_app.command("presets")
def presets():
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

@govern_app.command("load")
def load(
    target: str = typer.Argument(..., help="Preset name or path to YAML config"),
    server: str | None = typer.Option(None, "--server", "-s"),
):
    """Load a preset or custom YAML governance config."""
    if server:
        # If it's a file path, read and send as YAML config
        path = Path(target)
        if path.is_file():
            import httpx
            yaml_content = path.read_text()
            try:
                r = httpx.put(
                    f"{server}/governance/config",
                    json={"yaml": yaml_content},
                    timeout=5,
                )
                r.raise_for_status()
                rprint(f"[green]Loaded config from:[/green] {target}")
            except Exception as e:
                rprint(f"[red]Error:[/red] {e}")
                raise typer.Exit(1)
        else:
            import httpx
            try:
                r = httpx.post(f"{server}/governance/presets/{target}/load", timeout=5)
                r.raise_for_status()
                rprint(f"[green]Loaded preset:[/green] {target}")
            except Exception as e:
                rprint(f"[red]Error:[/red] {e}")
                raise typer.Exit(1)
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

@govern_app.command("validate")
def validate(
    file: str = typer.Argument(..., help="Path to YAML governance config"),
):
    """Validate a YAML governance config file."""
    from governance.loader import validate_yaml

    valid, message = validate_yaml(file)
    if valid:
        rprint(f"[green]Valid[/green] — {message}")
    else:
        rprint(f"[red]Invalid[/red] — {message}")
        raise typer.Exit(1)

@govern_app.command("audit")
def audit(
    server: str = typer.Option("http://localhost:8000", "--server", "-s"),
    limit: int = typer.Option(20, "--limit", "-n"),
):
    """Show recent audit trail from a running server."""
    import httpx

    try:
        r = httpx.get(f"{server}/governance/audit", params={"limit": limit}, timeout=5)
        r.raise_for_status()
        entries = r.json()
    except Exception as e:
        rprint(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)

    if not entries:
        rprint("[dim]No audit entries.[/dim]")
        return

    table = Table(title="Governance Audit Trail")
    table.add_column("Time", style="dim")
    table.add_column("Policy", style="cyan")
    table.add_column("Decision")
    table.add_column("Severity")
    table.add_column("Reason")

    for entry in entries:
        decision = entry.get("decision", "")
        color = {"deny": "red", "warn": "yellow", "allow": "green", "modify": "magenta"}.get(
            decision, "white"
        )
        table.add_row(
            str(entry.get("timestamp", "")),
            entry.get("policy_name", ""),
            f"[{color}]{decision}[/{color}]",
            entry.get("severity", ""),
            entry.get("reason", ""),
        )

    console.print(table)

@govern_app.command("init")
def init(
    domain: str = typer.Option("robotics", "--domain", "-d", help="Domain: robotics | desktop_agent | universal"),
    output: str = typer.Option("governance.yaml", "--output", "-o", help="Output file path"),
):
    """Generate a starter YAML governance config."""
    import yaml

    config = {
        "version": "1.0",
        "name": "my-governance-config",
        "domain": domain,
        "extends": [],
        "policies": [
            {
                "name": "workspace_boundaries",
                "type": "zone_policy",
                "enabled": True,
                "severity": "critical",
                "enforcement": "enforce",
                "config": {
                    "zones": [
                        {
                            "name": "danger_zone",
                            "level": "danger",
                            "shape": "circle",
                            "center": [0, 0, 0],
                            "radius_m": 0.5,
                            "on_violation": "halt",
                        }
                    ]
                },
            },
            {
                "name": "action_safety",
                "type": "action_filter",
                "enabled": True,
                "severity": "high",
                "enforcement": "enforce",
                "config": {"deny_patterns": ["throw", "launch"]},
            },
        ],
        "settings": {
            "log_all_decisions": True,
            "fail_open": False,
            "evaluation_timeout_ms": 50,
        },
    }

    path = Path(output)
    with open(path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    rprint(f"[green]Generated governance config:[/green] {path}")
    rprint(f"[dim]Edit the file to customize, then run: openeye govern validate {path}[/dim]")
