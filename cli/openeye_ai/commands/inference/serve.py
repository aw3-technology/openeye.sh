"""Serve command — FastAPI inference server."""

from __future__ import annotations

import time
from typing import Optional

import typer
from rich import print as rprint

from openeye_ai._cli_helpers import console, dependency_error, warmup_adapter
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import get_adapter, get_model_info, is_downloaded


def serve(
    model: str = typer.Argument(help="Model name to serve"),
    host: str = typer.Option("0.0.0.0", "--host", help="Bind host"),
    port: int = typer.Option(8000, "--port", help="Bind port"),
    demo: bool = typer.Option(False, "--demo", help="Demo mode: warm up model, show live status bar"),
    vlm_model: Optional[str] = typer.Option(None, "--vlm-model", help="VLM model ID for perception (e.g. qwen/qwen3.5-9b, openrouter/healer-alpha)"),
    cortex_llm: Optional[str] = typer.Option(None, "--cortex-llm", help="Cortex LLM model ID for reasoning (e.g. z-ai/glm-5-turbo, openrouter/hunter-alpha)"),
) -> None:
    """Start a FastAPI server with REST API, WebSocket, and browser dashboard."""
    if port < 1 or port > 65535:
        rprint(f"[red]Invalid port {port}. Must be between 1 and 65535.[/red]")
        raise typer.Exit(code=1)

    import threading

    import uvicorn

    from rich.live import Live
    from rich.panel import Panel
    from rich.text import Text

    from openeye_ai.server.app import create_app

    try:
        info = get_model_info(model)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    model_dir = MODELS_DIR / model

    if not is_downloaded(model):
        rprint(f"[yellow]Model '{model}' not downloaded. Run: openeye pull {model}[/yellow]")
        raise typer.Exit(code=1)

    try:
        adapter = get_adapter(model)
    except ImportError as e:
        dependency_error(model, e)

    with console.status(f"[bold]Loading {info['name']}...[/bold]"):
        try:
            adapter.load(model_dir)
        except ImportError as e:
            dependency_error(model, e)
        except Exception as e:
            rprint(f"[red]Failed to load model: {e}[/red]")
            raise typer.Exit(code=1)

    if demo:
        try:
            with console.status("[bold]Warming up model (demo mode)...[/bold]"):
                warmup_adapter(adapter, model)
        except Exception as e:
            rprint(f"[yellow]Warm-up failed ({e}), continuing anyway...[/yellow]")

    fastapi_app = create_app(
        adapter=adapter,
        model_name=model,
        model_info=info,
        vlm_model=vlm_model,
        cortex_llm=cortex_llm,
    )

    banner = (
        f"[bold green]* {info['name']}[/bold green] ready on "
        f"[bold]http://{host}:{port}[/bold]\n"
        f"  [dim]Dashboard[/dim]  -> http://localhost:{port}/\n"
        f"  [dim]API[/dim]       -> http://localhost:{port}/predict\n"
        f"  [dim]WebSocket[/dim] -> ws://localhost:{port}/ws\n"
        f"  [dim]Metrics[/dim]   -> http://localhost:{port}/metrics"
    )
    if demo:
        banner += "\n  [bold yellow]Demo mode[/bold yellow] -- model is warm, zero cold-start"
    console.print(Panel(banner, title="[bold]OpenEye Server[/bold]", border_style="green"))

    if not demo:
        uvicorn.run(fastapi_app, host=host, port=port, log_level="info")
    else:
        _run_demo_mode(fastapi_app, host, port, model, console)


def _run_demo_mode(fastapi_app, host: str, port: int, model: str, console) -> None:
    """Run uvicorn in a background thread with a live Rich status bar."""
    import threading

    import uvicorn

    from rich.live import Live
    from rich.panel import Panel
    from rich.text import Text

    from openeye_ai.server.metrics import ACTIVE_CONNECTIONS, REQUEST_COUNT

    server_start = time.monotonic()
    server_config = uvicorn.Config(
        fastapi_app, host=host, port=port, log_level="info",
    )
    server = uvicorn.Server(server_config)

    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    def _format_uptime(seconds: float) -> str:
        h, rem = divmod(int(seconds), 3600)
        m, s = divmod(rem, 60)
        if h > 0:
            return f"{h}h {m:02d}m {s:02d}s"
        return f"{m}m {s:02d}s"

    def _get_total_requests() -> int:
        total = 0.0
        try:
            for sample in REQUEST_COUNT.collect()[0].samples:
                total += sample.value
        except Exception:
            pass
        return int(total)

    def _get_active_connections() -> int:
        try:
            return int(ACTIVE_CONNECTIONS._value.get())
        except Exception:
            return 0

    try:
        with Live(console=console, refresh_per_second=2) as live:
            while server_thread.is_alive():
                elapsed = time.monotonic() - server_start
                total_reqs = _get_total_requests()
                active_conns = _get_active_connections()

                conn_style = "bold green" if active_conns > 0 else "dim"

                status_bar = Text.assemble(
                    ("  Uptime ", "dim"),
                    (_format_uptime(elapsed), "bold cyan"),
                    ("  |  Requests ", "dim"),
                    (f"{total_reqs:,}", "bold"),
                    ("  |  Connections ", "dim"),
                    (f"{active_conns}", conn_style),
                    ("  |  Model ", "dim"),
                    (model, "bold cyan"),
                    ("  |  ", "dim"),
                    ("LIVE", "bold green"),
                )

                live.update(
                    Panel(
                        status_bar,
                        title="[bold]OpenEye Server Status[/bold]",
                        border_style="green",
                    )
                )
                time.sleep(0.5)
    except KeyboardInterrupt:
        console.print("\n[dim]Shutting down server...[/dim]")
        server.should_exit = True
        server_thread.join(timeout=5)
