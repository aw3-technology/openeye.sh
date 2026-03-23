"""Single-model and all-models runners for the VLM OpenRouter demo."""

from __future__ import annotations

import asyncio

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from openeye_ai.demos._vlm_helpers import _query_vlm

console = Console()


async def _run_single(
    api_key: str,
    model: str,
    image_b64: str,
    prompt: str,
    image_label: str,
    *,
    base_url: str,
) -> None:
    """Run a single VLM query with spinner and styled output."""
    # Banner
    banner_lines = [
        f"[bold green]*[/bold green] Model:  [bold]{model}[/bold]",
        f"[bold green]*[/bold green] Image:  [bold]{image_label}[/bold]",
        f"[bold green]*[/bold green] Prompt: [dim]{prompt[:80]}{'...' if len(prompt) > 80 else ''}[/dim]",
    ]
    console.print(Panel(
        "\n".join(banner_lines),
        title="[bold cyan]OpenEye VLM Demo[/bold cyan]",
        subtitle="[dim]OpenRouter[/dim]",
        border_style="cyan",
    ))

    # Query with spinner
    with console.status(f"[bold]Querying {model}...[/bold]", spinner="dots"):
        try:
            text, elapsed = await _query_vlm(api_key, model, image_b64, prompt, base_url=base_url)
        except Exception as e:
            console.print(f"[red]API error: {e}[/red]")
            return

    # Result
    latency_style = "green" if elapsed < 5 else ("yellow" if elapsed < 15 else "red")
    header = Text()
    header.append("Latency: ", style="dim")
    header.append(f"{elapsed:.1f}s", style=f"bold {latency_style}")

    console.print()
    console.print(Panel(
        text,
        title="[bold]VLM Response[/bold]",
        subtitle=str(header),
        border_style="green",
        padding=(1, 2),
    ))


async def _run_all_models(
    api_key: str,
    image_b64: str,
    prompt: str,
    image_label: str,
    *,
    free_models: list[tuple[str, str]],
    base_url: str,
) -> None:
    """Run all free models concurrently and display results in a table."""
    console.print(Panel(
        f"[bold green]*[/bold green] Image:  [bold]{image_label}[/bold]\n"
        f"[bold green]*[/bold green] Models: [bold]{len(free_models)}[/bold] free VLMs\n"
        f"[bold green]*[/bold green] Prompt: [dim]{prompt[:80]}{'...' if len(prompt) > 80 else ''}[/dim]",
        title="[bold cyan]OpenEye VLM — Model Comparison[/bold cyan]",
        subtitle="[dim]OpenRouter[/dim]",
        border_style="cyan",
    ))

    results: list[tuple[str, str, str | None, float]] = []

    with console.status("[bold]Querying all models concurrently...[/bold]", spinner="dots"):
        tasks = []
        for model_id, model_name in free_models:
            tasks.append(_query_vlm(api_key, model_id, image_b64, prompt, base_url=base_url))

        outcomes = await asyncio.gather(*tasks, return_exceptions=True)

        for (model_id, model_name), outcome in zip(free_models, outcomes):
            if isinstance(outcome, Exception):
                results.append((model_id, model_name, None, 0.0))
            else:
                text, elapsed = outcome
                results.append((model_id, model_name, text, elapsed))

    # Display results
    console.print()
    for model_id, model_name, text, elapsed in results:
        if text is None:
            console.print(Panel(
                "[red]Error — model did not respond[/red]",
                title=f"[bold]{model_name}[/bold]",
                border_style="red",
            ))
        else:
            latency_style = "green" if elapsed < 5 else ("yellow" if elapsed < 15 else "red")
            subtitle = Text()
            subtitle.append(f"{elapsed:.1f}s", style=f"bold {latency_style}")
            subtitle.append(f"  |  {model_id}", style="dim")

            console.print(Panel(
                text,
                title=f"[bold]{model_name}[/bold]",
                subtitle=str(subtitle),
                border_style="cyan",
                padding=(1, 2),
            ))
        console.print()

    # Summary table
    table = Table(title="Comparison Summary", border_style="cyan")
    table.add_column("Model", style="bold")
    table.add_column("Latency", justify="right")
    table.add_column("Response Length", justify="right")
    table.add_column("Status", justify="center")

    for model_id, model_name, text, elapsed in results:
        if text is None:
            table.add_row(model_name, "—", "—", Text("FAIL", style="bold red"))
        else:
            latency_style = "green" if elapsed < 5 else ("yellow" if elapsed < 15 else "red")
            table.add_row(
                model_name,
                Text(f"{elapsed:.1f}s", style=latency_style),
                f"{len(text)} chars",
                Text("OK", style="bold green"),
            )

    console.print(table)
