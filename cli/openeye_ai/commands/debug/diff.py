"""debug diff — compare before/after screenshots for visual regressions."""

from __future__ import annotations

from pathlib import Path

import typer

from openeye_ai.commands.debug import debug_app

@debug_app.command("diff")
def diff(
    before: Path = typer.Argument(..., help="Path to before screenshot"),
    after: Path = typer.Argument(..., help="Path to after screenshot"),
    output: Path | None = typer.Option(None, "--output", "-o", help="Write JSON report to file"),
    fail_on: str | None = typer.Option(None, "--fail-on", help="Exit code 1 if severity found (critical|warning)"),
    format: str | None = typer.Option(None, "--format", "-f", help="Output format: json|junit|github"),
    baseline_dir: Path | None = typer.Option(None, "--baseline-dir", help="Directory of baseline images"),
    current_dir: Path | None = typer.Option(None, "--current-dir", help="Directory of current images"),
    vlm_model: str | None = typer.Option(None, "--vlm-model", help="Override VLM model"),
) -> None:
    """Compare before/after screenshots for visual regressions."""
    import asyncio
    import json

    from rich import print as rprint
    from rich.table import Table
    from rich.panel import Panel

    from openeye_ai._cli_helpers import console, err_console

    # Batch mode
    if baseline_dir and current_dir:
        _run_batch_diff(baseline_dir, current_dir, output, fail_on, format, vlm_model)
        return

    from PIL import Image

    try:
        img_before = Image.open(before).convert("RGB")
        img_after = Image.open(after).convert("RGB")
    except Exception as e:
        rprint(f"[red]Failed to open images: {e}[/red]")
        raise typer.Exit(code=1)

    # Pixel-level diff
    pixel_diff_pct = 0.0
    ssim_score = 1.0
    try:
        from openeye_ai.debug.diff_engine import PixelDiffEngine

        engine = PixelDiffEngine()
        pixel_result = engine.compute_diff(img_before, img_after)
        pixel_diff_pct = pixel_result["pixel_diff_pct"]
        ssim_score = pixel_result["ssim"]
    except ImportError:
        pass  # scikit-image not installed, skip pixel diff

    # VLM semantic diff
    with err_console.status("[bold]Analyzing visual diff with VLM..."):
        from openeye_ai.debug.analyzer import UIDebugAnalyzer

        analyzer = UIDebugAnalyzer(vlm_model=vlm_model)
        result = asyncio.get_event_loop().run_until_complete(
            analyzer.diff_screenshots(img_before, img_after)
        )

    result.pixel_diff_pct = round(pixel_diff_pct, 2)
    result.ssim = round(ssim_score, 4)

    # Output
    if output:
        output.write_text(json.dumps(result.model_dump(), indent=2))
        rprint(f"[green]Diff report written to {output}[/green]")

    if format == "junit":
        _output_junit(result, before, after)
    elif format == "github":
        _output_github_annotations(result, before, after)
    else:
        _print_diff(result, console)

    # Fail on severity
    if fail_on:
        severities = [c.severity for c in result.changes]
        if fail_on == "critical" and "critical" in severities:
            raise typer.Exit(code=1)
        if fail_on == "warning" and ("critical" in severities or "warning" in severities):
            raise typer.Exit(code=1)

def _print_diff(result, console) -> None:
    """Pretty-print a DiffResult with Rich."""
    from rich.table import Table
    from rich.panel import Panel

    status = "[red]REGRESSION DETECTED[/red]" if result.regression_detected else "[green]No regressions[/green]"

    console.print(Panel(
        f"{status}\n"
        f"Pixel diff: {result.pixel_diff_pct:.1f}%  |  SSIM: {result.ssim:.4f}\n"
        f"{result.summary}\n"
        f"Analysis: {result.analysis_ms:.0f}ms ({result.model})",
        title="[bold]Visual Diff Results",
        border_style="red" if result.regression_detected else "green",
    ))

    if result.changes:
        table = Table(show_header=True, padding=(0, 1))
        table.add_column("Type", width=14)
        table.add_column("Severity", width=10)
        table.add_column("Description", ratio=2)
        table.add_column("Suggestion", ratio=1)

        for change in result.changes:
            style = {"critical": "red bold", "warning": "yellow", "info": "blue"}.get(change.severity, "")
            table.add_row(
                change.type,
                f"[{style}]{change.severity.upper()}[/{style}]",
                change.description,
                change.suggestion,
            )
        console.print(table)

def _run_batch_diff(baseline_dir, current_dir, output, fail_on, format, vlm_model) -> None:
    """Run diff across matching files in two directories."""
    import asyncio
    import json

    from rich import print as rprint
    from openeye_ai._cli_helpers import console

    baseline_files = {f.name: f for f in baseline_dir.iterdir() if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")}
    current_files = {f.name: f for f in current_dir.iterdir() if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")}

    common = sorted(set(baseline_files) & set(current_files))
    if not common:
        rprint("[yellow]No matching image pairs found.[/yellow]")
        raise typer.Exit(code=0)

    from PIL import Image
    from openeye_ai.debug.analyzer import UIDebugAnalyzer

    analyzer = UIDebugAnalyzer(vlm_model=vlm_model)
    all_results = {}
    has_regression = False

    for name in common:
        rprint(f"  Comparing [cyan]{name}[/cyan]...")
        img_before = Image.open(baseline_files[name]).convert("RGB")
        img_after = Image.open(current_files[name]).convert("RGB")

        result = asyncio.get_event_loop().run_until_complete(
            analyzer.diff_screenshots(img_before, img_after)
        )
        all_results[name] = result.model_dump()
        if result.regression_detected:
            has_regression = True

    if output:
        output.write_text(json.dumps(all_results, indent=2))
        rprint(f"[green]Batch diff report written to {output}[/green]")

    if fail_on and has_regression:
        raise typer.Exit(code=1)

def _output_junit(result, before: Path, after: Path) -> None:
    """Output diff result as JUnit XML to stdout."""
    import xml.etree.ElementTree as ET

    suite = ET.Element("testsuite", name="visual-regression", tests=str(len(result.changes) or 1))
    if not result.changes:
        tc = ET.SubElement(suite, "testcase", name=f"{before.name} vs {after.name}")
    else:
        for change in result.changes:
            tc = ET.SubElement(suite, "testcase", name=change.description[:80])
            if change.type == "regression":
                failure = ET.SubElement(tc, "failure", message=change.description)
                failure.text = change.suggestion

    print(ET.tostring(suite, encoding="unicode", xml_declaration=True))

def _output_github_annotations(result, before: Path, after: Path) -> None:
    """Output diff result as GitHub Actions annotations."""
    for change in result.changes:
        level = "error" if change.severity == "critical" else "warning"
        print(f"::{level} file={after},title=Visual Regression::{change.description}")
