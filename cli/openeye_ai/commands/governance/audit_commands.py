"""Audit and violation commands for governance CLI."""

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


def _print_audit_table(entries: list[dict], title: str = "Governance Audit Trail") -> None:
    """Shared helper to print audit/violation entries as a Rich table."""
    if not entries:
        rprint(f"[dim]No {title.lower().replace('governance ', '')} found.[/dim]")
        return

    table = Table(title=title)
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


def audit(
    server: str | None = typer.Option(None, "--server", "-s"),
    limit: int = typer.Option(20, "--limit", "-n"),
) -> None:
    """Show recent audit trail."""
    if server:
        entries = GovernanceClient(server).get_audit(limit=limit)
    else:
        engine = _get_engine()
        entries = [e.model_dump(mode="json") for e in engine.audit.get_entries(limit=limit)]

    _print_audit_table(entries, title="Governance Audit Trail")


def violations(
    server: str | None = typer.Option(None, "--server", "-s"),
    limit: int = typer.Option(20, "--limit", "-n"),
) -> None:
    """Show governance violations (filtered from audit trail)."""
    if server:
        entries = GovernanceClient(server).get_violations(limit=limit)
    else:
        engine = _get_engine()
        entries = [e.model_dump(mode="json") for e in engine.audit.get_violations(limit=limit)]

    _print_audit_table(entries, title="Governance Violations")
