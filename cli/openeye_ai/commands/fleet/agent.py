"""Device agent command — runs on edge devices."""

from __future__ import annotations

import asyncio

import typer
from rich import print as rprint

from ._helpers import _BASE_URL, fleet_app


@fleet_app.command("agent")
def start_agent(
    device_id: str = typer.Option(..., "--device-id", "-d", help="Device UUID"),
    api_key: str = typer.Option("", "--api-key", "-k", envvar="OPENEYE_DEVICE_API_KEY"),
    server_url: str = typer.Option(_BASE_URL, "--server", "-s"),
    interval: float = typer.Option(15.0, "--interval", help="Heartbeat interval in seconds"),
) -> None:
    """Start the device agent (runs on edge devices)."""
    if not api_key:
        rprint("[red]Error: API key is required. Set --api-key or OPENEYE_DEVICE_API_KEY env var.[/red]")
        raise typer.Exit(code=1)
    if not server_url.startswith(("http://", "https://")):
        rprint("[red]Error: Server URL must start with http:// or https://[/red]")
        raise typer.Exit(code=1)
    if interval < 1:
        rprint("[red]Error: Heartbeat interval must be at least 1 second[/red]")
        raise typer.Exit(code=1)
    try:
        from fleet.agent.agent import DeviceAgent
        from fleet.agent.config import AgentConfig
    except ImportError:
        rprint("[yellow]Running with backend package import path...[/yellow]")
        from openeye_ai._cli_helpers import ensure_backend_path
        ensure_backend_path()
        from fleet.agent.agent import DeviceAgent
        from fleet.agent.config import AgentConfig

    config = AgentConfig(
        device_id=device_id,
        api_key=api_key,
        server_url=server_url,
        heartbeat_interval=interval,
    )
    agent = DeviceAgent(config)
    rprint(f"[green]Starting device agent[/green] (device={device_id})")
    import signal

    def _sigterm_handler(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _sigterm_handler)

    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        agent.stop()
        rprint("[yellow]Agent stopped[/yellow]")
