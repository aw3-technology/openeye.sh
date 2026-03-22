"""Server utility CLI commands — health, stats, config."""

from __future__ import annotations

import json

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import SERVER_URL as _SERVER_URL, err_console as console, http_request


def _server_url(server: str | None) -> str:
    return server or _SERVER_URL


# ── health ────────────────────────────────────────────────────────


def health(
    server: str | None = typer.Option(None, "--server", "-s", help="Server URL"),
) -> None:
    """Check server health and queue status."""
    url = _server_url(server)

    r = http_request("GET", f"{url}/health", timeout=5)
    health_data = r.json()

    queue_data = {}
    try:
        import httpx

        queue_r = httpx.get(f"{url}/queue/status", timeout=5)
        queue_r.raise_for_status()
        queue_data = queue_r.json()
    except Exception:
        pass

    table = Table(title="Server Health", show_header=False)
    table.add_column("Field", style="cyan")
    table.add_column("Value")

    table.add_row("Status", "[green]Healthy[/green]")
    table.add_row("Model", health_data.get("model", "—"))
    table.add_row("Loaded", "[green]Yes[/green]" if health_data.get("loaded") else "[red]No[/red]")
    table.add_row("Uptime", str(health_data.get("uptime", "—")))

    if queue_data:
        table.add_row("Queue active", str(queue_data.get("active", 0)))
        table.add_row("Queue pending", str(queue_data.get("queued", 0)))

    console.print(table)


# ── nebius-stats ──────────────────────────────────────────────────


def nebius_stats(
    server: str | None = typer.Option(None, "--server", "-s", help="Server URL"),
) -> None:
    """Show Nebius VLM usage statistics from a running server."""
    url = _server_url(server)
    r = http_request("GET", f"{url}/nebius/stats", timeout=5)
    data = r.json()

    table = Table(title="Nebius VLM Stats", show_header=False)
    table.add_column("Metric", style="cyan")
    table.add_column("Value")

    table.add_row("Total calls", str(data.get("total_calls", 0)))
    table.add_row("Total tokens", str(data.get("total_tokens", 0)))
    table.add_row("Total errors", str(data.get("total_errors", 0)))
    table.add_row("Avg latency", f"{data.get('avg_latency_ms', 0):.1f} ms")
    table.add_row("Model", data.get("model", "—"))

    if data.get("by_model"):
        for model_name, stats in data["by_model"].items():
            table.add_row(f"  {model_name}", f"{stats.get('calls', 0)} calls, {stats.get('tokens', 0)} tokens")

    console.print(table)


# ── server-config ─────────────────────────────────────────────────


def server_config_get(
    server: str | None = typer.Option(None, "--server", "-s", help="Server URL"),
) -> None:
    """Get runtime configuration from a running server."""
    url = _server_url(server)
    r = http_request("GET", f"{url}/config", timeout=5)
    data = r.json()

    rprint(json.dumps(data, indent=2))


def server_config_set(
    key: str = typer.Argument(help="Config key to set"),
    value: str = typer.Argument(help="Config value (JSON or string)"),
    server: str | None = typer.Option(None, "--server", "-s", help="Server URL"),
) -> None:
    """Update a runtime config value on a running server."""
    url = _server_url(server)

    # Try parsing value as JSON, fall back to string
    try:
        parsed_value = json.loads(value)
    except json.JSONDecodeError:
        parsed_value = value

    # GET current config, update key, PUT back
    r = http_request("GET", f"{url}/config", timeout=5)
    config = r.json()

    config[key] = parsed_value

    http_request("PUT", f"{url}/config", json=config, timeout=5)

    rprint(f"[green]Config updated:[/green] {key} = {parsed_value}")
