"""Agentic loop CLI commands — `openeye agent ...`."""

from __future__ import annotations

import json
import os
import signal
import sys
import time
from typing import Optional

import typer
from rich import print as rprint
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.table import Table

agent_app = typer.Typer(help="Agentic perception loop — perceive, reason, act.")

console = Console(stderr=True)

_SERVER_URL = os.environ.get("OPENEYE_SERVER_URL", "http://localhost:8000")


def _server_url(server: str | None) -> str:
    return server or _SERVER_URL


# ── agent run (local) ─────────────────────────────────────────────


@agent_app.command("run")
def agent_run(
    model: str = typer.Option("yolov8", "--model", "-m", help="Detection model to use"),
    goal: str = typer.Option("monitor the scene", "--goal", "-g", help="Agent goal"),
    hz: float = typer.Option(1.0, "--hz", help="Loop frequency in Hz"),
    video: Optional[str] = typer.Option(None, "--video", help="Video file path (fallback if no camera)"),
    max_ticks: Optional[int] = typer.Option(None, "--max-ticks", help="Stop after N ticks"),
    vlm: bool = typer.Option(False, "--vlm", help="Enable VLM reasoning via Nebius"),
) -> None:
    """Run the agentic perception loop locally on camera or video."""
    from openeye_ai.config import MODELS_DIR
    from openeye_ai.registry import get_adapter, is_downloaded

    if not is_downloaded(model):
        rprint(f"[yellow]Model '{model}' not downloaded. Run: openeye pull {model}[/yellow]")
        raise typer.Exit(code=1)

    try:
        adapter = get_adapter(model)
    except ImportError as e:
        from openeye_ai._cli_helpers import dependency_error
        dependency_error(model, e)

    model_dir = MODELS_DIR / model
    with console.status(f"Loading {model}..."):
        adapter.load(model_dir)

    # Set up camera
    camera = None
    if video:
        from openeye_ai.utils.video_player import VideoPlayer
        camera = VideoPlayer(video)
    else:
        try:
            from openeye_ai.utils.camera import Camera
            camera = Camera()
        except Exception:
            if video is None:
                rprint("[red]No camera available. Use --video <path> for a video file.[/red]")
                raise typer.Exit(code=1)

    # Optional VLM
    llm_call = None
    if vlm:
        try:
            from openeye_ai.vlm.nebius import create_vlm_caller
            llm_call = create_vlm_caller()
            rprint("[green]VLM reasoning enabled[/green]")
        except Exception as e:
            rprint(f"[yellow]VLM unavailable: {e}. Using fallback reasoning.[/yellow]")

    from openeye_ai.agent.loop import AgentLoop

    loop = AgentLoop(
        adapters={model: adapter},
        camera=camera,
        hz=hz,
        goal=goal,
        llm_call=llm_call,
    )

    tick_count = 0

    def _on_tick(event):
        nonlocal tick_count
        if event.phase == "act":
            tick_count += 1
            phase_style = {"perceive": "cyan", "recall": "blue", "reason": "yellow", "act": "green"}.get(event.phase, "white")
            rprint(
                f"[dim]tick {event.tick:>4}[/dim] "
                f"[{phase_style}]{event.phase:>8}[/{phase_style}] "
                f"| {event.action_taken or 'continue monitoring'}"
            )
            if event.observation:
                rprint(f"         [dim]{event.observation.scene_summary}[/dim]")
            if event.reasoning and event.reasoning.chain_of_thought:
                rprint(f"         [dim yellow]thought: {event.reasoning.chain_of_thought[:120]}[/dim yellow]")

            if max_ticks and tick_count >= max_ticks:
                loop.stop()

    loop.on_tick(_on_tick)

    def _sigterm(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _sigterm)

    rprint(f"[bold green]Agent started[/bold green] | model={model} | goal=\"{goal}\" | hz={hz}")
    rprint("[dim]Press Ctrl+C to stop[/dim]")

    try:
        loop.run()
    except KeyboardInterrupt:
        loop.stop()
        rprint(f"\n[yellow]Agent stopped after {tick_count} ticks[/yellow]")


# ── agent start (server) ──────────────────────────────────────────


@agent_app.command("start")
def agent_start(
    goal: str = typer.Option("monitor the scene", "--goal", "-g", help="Agent goal"),
    server: Optional[str] = typer.Option(None, "--server", "-s", help="Server URL"),
) -> None:
    """Start the agentic loop on a running server."""
    import httpx

    url = _server_url(server)
    try:
        r = httpx.post(f"{url}/agent/start", json={"goal": goal}, timeout=10)
        r.raise_for_status()
        data = r.json()
        rprint(f"[green]Agent started:[/green] {data.get('status', 'running')}")
        rprint(f"  Goal: {data.get('goal', goal)}")
    except httpx.ConnectError:
        rprint(f"[red]Cannot connect to server at {url}[/red]")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as exc:
        rprint(f"[red]Error {exc.response.status_code}: {exc.response.text[:200]}[/red]")
        raise typer.Exit(code=1)


# ── agent stop (server) ───────────────────────────────────────────


@agent_app.command("stop")
def agent_stop(
    server: Optional[str] = typer.Option(None, "--server", "-s", help="Server URL"),
) -> None:
    """Stop the agentic loop on a running server."""
    import httpx

    url = _server_url(server)
    try:
        r = httpx.post(f"{url}/agent/stop", timeout=10)
        r.raise_for_status()
        data = r.json()
        rprint(f"[yellow]Agent stopped:[/yellow] {data.get('ticks', '?')} ticks completed")
    except httpx.ConnectError:
        rprint(f"[red]Cannot connect to server at {url}[/red]")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as exc:
        rprint(f"[red]Error {exc.response.status_code}: {exc.response.text[:200]}[/red]")
        raise typer.Exit(code=1)


# ── agent status (server) ─────────────────────────────────────────


@agent_app.command("status")
def agent_status(
    server: Optional[str] = typer.Option(None, "--server", "-s", help="Server URL"),
) -> None:
    """Show agentic loop status on a running server."""
    import httpx

    url = _server_url(server)
    try:
        r = httpx.get(f"{url}/agent/status", timeout=10)
        r.raise_for_status()
        data = r.json()
    except httpx.ConnectError:
        rprint(f"[red]Cannot connect to server at {url}[/red]")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as exc:
        rprint(f"[red]Error {exc.response.status_code}: {exc.response.text[:200]}[/red]")
        raise typer.Exit(code=1)

    running = data.get("running", False)
    table = Table(title="Agent Status", show_header=False)
    table.add_column("Field", style="cyan")
    table.add_column("Value")

    table.add_row("Running", "[green]Yes[/green]" if running else "[dim]No[/dim]")
    table.add_row("Goal", data.get("goal", "—"))
    table.add_row("Ticks", str(data.get("ticks", 0)))

    plan = data.get("current_plan", [])
    if plan:
        plan_str = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(plan))
        table.add_row("Plan", plan_str)
    else:
        table.add_row("Plan", "[dim]No plan[/dim]")

    console.print(table)


# ── agent memory (server) ─────────────────────────────────────────


@agent_app.command("memory")
def agent_memory(
    limit: int = typer.Option(10, "--limit", "-n", help="Number of recent observations"),
    server: Optional[str] = typer.Option(None, "--server", "-s", help="Server URL"),
) -> None:
    """Show recent observations from the agent's memory."""
    import httpx

    url = _server_url(server)
    try:
        r = httpx.get(f"{url}/agent/memory", params={"limit": limit}, timeout=10)
        r.raise_for_status()
        observations = r.json()
    except httpx.ConnectError:
        rprint(f"[red]Cannot connect to server at {url}[/red]")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as exc:
        rprint(f"[red]Error {exc.response.status_code}: {exc.response.text[:200]}[/red]")
        raise typer.Exit(code=1)

    if not observations:
        rprint("[dim]No observations in memory.[/dim]")
        return

    table = Table(title="Agent Memory")
    table.add_column("Tick", justify="right")
    table.add_column("Scene Summary")
    table.add_column("Changes")
    table.add_column("Significance", justify="right")
    table.add_column("Tags")

    for obs in observations:
        sig = obs.get("significance", 0)
        sig_style = "green" if sig < 0.3 else "yellow" if sig < 0.7 else "red"
        table.add_row(
            str(obs.get("tick", "?")),
            obs.get("scene_summary", "—"),
            obs.get("change_description", "") or "—",
            f"[{sig_style}]{sig:.2f}[/{sig_style}]",
            ", ".join(obs.get("tags", [])) or "—",
        )

    console.print(table)


# ── agent recall (server) ─────────────────────────────────────────


@agent_app.command("recall")
def agent_recall(
    query: str = typer.Argument(help="Natural language query to search memory"),
    limit: int = typer.Option(5, "--limit", "-n", help="Max results"),
    server: Optional[str] = typer.Option(None, "--server", "-s", help="Server URL"),
) -> None:
    """Query agent memory with a natural language search."""
    import httpx

    url = _server_url(server)
    try:
        r = httpx.post(
            f"{url}/agent/recall",
            json={"query": query, "limit": limit},
            timeout=10,
        )
        r.raise_for_status()
        results = r.json()
    except httpx.ConnectError:
        rprint(f"[red]Cannot connect to server at {url}[/red]")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as exc:
        rprint(f"[red]Error {exc.response.status_code}: {exc.response.text[:200]}[/red]")
        raise typer.Exit(code=1)

    if not results:
        rprint(f"[dim]No matching observations for '{query}'.[/dim]")
        return

    for obs in results:
        rprint(
            f"  [cyan]tick {obs.get('tick', '?')}[/cyan] "
            f"| {obs.get('scene_summary', '—')} "
            f"[dim]({', '.join(obs.get('tags', []))})[/dim]"
        )
