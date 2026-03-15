"""debug screenshot — analyze a screenshot or URL for UI issues."""

from __future__ import annotations

from pathlib import Path

import typer

from openeye_ai.commands.debug import debug_app

@debug_app.command("screenshot")
def screenshot(
    image_path: Path | None = typer.Argument(None, help="Path to screenshot image"),
    url: str | None = typer.Option(None, "--url", "-u", help="URL to capture and analyze"),
    output: Path | None = typer.Option(None, "--output", "-o", help="Write JSON report to file"),
    visualize: bool = typer.Option(False, "--visualize", help="Save annotated image with issue overlays"),
    vlm_model: str | None = typer.Option(None, "--vlm-model", help="Override VLM model"),
) -> None:
    """Analyze a screenshot or URL for UI issues."""
    import asyncio

    from rich import print as rprint
    from rich.panel import Panel
    from rich.table import Table

    from openeye_ai._cli_helpers import console, err_console

    if not image_path and not url:
        rprint("[red]Provide an image path or --url to analyze.[/red]")
        raise typer.Exit(code=1)

    # Load image
    img = None
    if url:
        with err_console.status(f"[bold]Capturing {url}..."):
            try:
                from openeye_ai.utils.screen_capture import BrowserCapture

                cap = BrowserCapture(url)
                img = cap.read_pil()
                cap.release()
            except ImportError:
                rprint("[red]playwright not installed. Run: pip install playwright && playwright install chromium[/red]")
                raise typer.Exit(code=1)
            except Exception as e:
                rprint(f"[red]Failed to capture URL: {e}[/red]")
                raise typer.Exit(code=1)
    else:
        from PIL import Image

        try:
            img = Image.open(image_path).convert("RGB")
        except Exception as e:
            rprint(f"[red]Failed to open image: {e}[/red]")
            raise typer.Exit(code=1)

    if img is None:
        rprint("[red]Failed to obtain image.[/red]")
        raise typer.Exit(code=1)

    # Run analysis
    with err_console.status("[bold]Analyzing UI with VLM..."):
        from openeye_ai.debug.analyzer import UIDebugAnalyzer

        analyzer = UIDebugAnalyzer(vlm_model=vlm_model)
        result = asyncio.get_event_loop().run_until_complete(
            analyzer.analyze_screenshot(img)
        )

    # Output JSON if requested
    if output:
        import json

        output.write_text(json.dumps(result.model_dump(), indent=2))
        rprint(f"[green]Report written to {output}[/green]")

    # Visualize if requested
    if visualize:
        _save_annotated_image(img, result, image_path or Path("capture.png"))

    # Pretty print results
    _print_analysis(result, console)

def _print_analysis(result, console) -> None:
    """Pretty-print a DebugAnalysis with Rich."""
    from rich.table import Table
    from rich.panel import Panel

    if not result.issues:
        console.print(Panel(
            f"[green]No issues found![/green]\nScore: {result.overall_score}/100\n{result.summary}",
            title="[bold]UI Analysis",
            border_style="green",
        ))
        return

    table = Table(show_header=True, padding=(0, 1))
    table.add_column("Severity", width=10)
    table.add_column("Type", width=14)
    table.add_column("Description", ratio=2)
    table.add_column("Suggestion", ratio=1)
    table.add_column("WCAG", width=10)

    severity_style = {"critical": "red bold", "warning": "yellow", "info": "blue"}

    for issue in result.issues:
        style = severity_style.get(issue.severity, "")
        table.add_row(
            f"[{style}]{issue.severity.upper()}[/{style}]",
            issue.type,
            issue.description,
            issue.suggestion,
            issue.wcag_criterion or "-",
        )

    # Category scores
    cat_parts = []
    for cat, score in result.categories.items():
        style = "green" if score >= 80 else "yellow" if score >= 60 else "red"
        cat_parts.append(f"{cat}: [{style}]{score}[/{style}]")

    console.print(Panel(
        f"Score: [bold]{result.overall_score}/100[/bold]  |  {' | '.join(cat_parts)}\n"
        f"{result.summary}\n"
        f"Analysis: {result.analysis_ms:.0f}ms ({result.model})",
        title="[bold]UI Analysis Results",
        border_style="cyan",
    ))
    console.print(table)

def _save_annotated_image(img, result, base_path: Path) -> None:
    """Save image with issue bounding boxes overlaid."""
    from PIL import ImageDraw, ImageFont

    draw = ImageDraw.Draw(img)
    w, h = img.size

    colors = {"critical": "red", "warning": "orange", "info": "dodgerblue"}

    for issue in result.issues:
        bbox = issue.bbox
        x1 = int(bbox.x * w)
        y1 = int(bbox.y * h)
        x2 = int((bbox.x + bbox.w) * w)
        y2 = int((bbox.y + bbox.h) * h)
        color = colors.get(issue.severity, "white")

        if bbox.w > 0 and bbox.h > 0:
            draw.rectangle([x1, y1, x2, y2], outline=color, width=2)
            draw.text((x1, y1 - 12), f"{issue.severity}: {issue.type}", fill=color)

    out_path = base_path.with_stem(base_path.stem + "_annotated")
    img.save(out_path)
    from rich import print as rprint

    rprint(f"[green]Annotated image saved to {out_path}[/green]")
