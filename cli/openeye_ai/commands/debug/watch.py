"""debug watch — continuously monitor a live app for visual issues."""

from __future__ import annotations

import typer

from openeye_ai.commands.debug import debug_app

@debug_app.command("watch")
def watch(
    url: str | None = typer.Option(None, "--url", "-u", help="URL to watch continuously"),
    screen: bool = typer.Option(False, "--screen", help="Capture screen region"),
    interval: float = typer.Option(5.0, "--interval", "-i", help="Seconds between captures"),
    vlm_model: str | None = typer.Option(None, "--vlm-model", help="Override VLM model"),
) -> None:
    """Continuously monitor a live app for visual issues."""
    import asyncio
    import time

    from rich import print as rprint
    from rich.live import Live
    from rich.table import Table
    from rich.panel import Panel

    from openeye_ai._cli_helpers import console

    if not url and not screen:
        rprint("[red]Provide --url or --screen to watch.[/red]")
        raise typer.Exit(code=1)

    # Set up capture source
    capture = None
    if url:
        try:
            from openeye_ai.utils.screen_capture import BrowserCapture

            capture = BrowserCapture(url)
        except ImportError:
            rprint("[red]playwright not installed. Run: pip install playwright && playwright install chromium[/red]")
            raise typer.Exit(code=1)
    elif screen:
        try:
            from openeye_ai.utils.screen_capture import ScreenCapture

            capture = ScreenCapture()
        except ImportError:
            rprint("[red]mss not installed. Run: pip install mss[/red]")
            raise typer.Exit(code=1)

    from openeye_ai.debug.analyzer import UIDebugAnalyzer

    analyzer = UIDebugAnalyzer(vlm_model=vlm_model)

    frame_count = 0
    last_summary = "Starting..."
    issues_history: list[dict] = []

    def build_display() -> Panel:
        table = Table(show_header=True, box=None, padding=(0, 1))
        table.add_column("Frame", style="cyan", width=6)
        table.add_column("Score", width=6)
        table.add_column("Issues", width=8)
        table.add_column("Summary", ratio=1)

        for entry in issues_history[-10:]:
            score = entry["score"]
            score_style = (
                "green" if score >= 80 else "yellow" if score >= 60 else "red"
            )
            table.add_row(
                str(entry["frame"]),
                f"[{score_style}]{score}[/{score_style}]",
                str(entry["issue_count"]),
                entry["summary"][:60],
            )

        source = url or "screen"
        return Panel(
            table,
            title=f"[bold]OpenEye Visual Debugger[/bold] — watching {source}",
            subtitle=f"Frame #{frame_count} | {interval}s interval | Ctrl+C to stop",
            border_style="green",
        )

    try:
        with Live(build_display(), console=console, refresh_per_second=1) as live:
            while True:
                img = capture.read_pil()
                if img is None:
                    time.sleep(interval)
                    continue

                frame_count += 1
                change_ctx = f"Previous: {last_summary}" if last_summary else ""

                result = asyncio.get_event_loop().run_until_complete(
                    analyzer.analyze_live_frame(
                        img, frame_count, interval, change_ctx
                    )
                )

                last_summary = result.summary
                issues_history.append({
                    "frame": frame_count,
                    "score": result.overall_score,
                    "issue_count": len(result.issues),
                    "summary": result.summary,
                })

                live.update(build_display())
                time.sleep(interval)

    except KeyboardInterrupt:
        rprint("\n[yellow]Watch stopped.[/yellow]")
    finally:
        if capture:
            capture.release()
