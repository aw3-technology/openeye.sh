"""Shared CLI helpers — consoles, constants, and utility functions."""

from __future__ import annotations

import typer
from rich import print as rprint
from rich.console import Console

console = Console()
# Separate console for status/progress in commands whose primary output is JSON
# to stdout, so spinners don't corrupt piped output.
err_console = Console(stderr=True)

_EXTRAS = {
    "yolov8": "yolo",
    "yolo26": "yolo",
    "depth-anything": "depth",
    "grounding-dino": "grounding",
    "sam2": "sam",
    "rfdetr": "rfdetr",
    "smolvla": "smolvla",
}

_DEMO_WARMUP_RUNS = 5


def warmup_adapter(adapter, name: str, runs: int = _DEMO_WARMUP_RUNS) -> float:
    """Run dummy inference passes to warm up the model. Returns mean latency in ms."""
    import time

    import numpy as np
    from PIL import Image

    arr = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    test_img = Image.fromarray(arr)

    times: list[float] = []
    for _ in range(runs):
        t0 = time.perf_counter()
        adapter.predict(test_img)
        times.append((time.perf_counter() - t0) * 1000)

    mean = sum(times) / len(times) if times else 0.0
    fps_str = f"{1000 / mean:.0f}" if mean > 0 else "∞"
    rprint(
        f"  [dim]Warm-up complete:[/dim] {runs} passes, "
        f"mean [bold cyan]{mean:.1f} ms[/bold cyan] "
        f"([bold cyan]{fps_str} FPS[/bold cyan])"
    )
    return mean


def _install_hint(extra: str) -> str:
    """Return install instructions that cover pip, pipx, and zsh quoting."""
    return (
        f'Install with: [bold]pip install "openeye-sh\\[{extra}]"[/bold]\n'
        f'  or (pipx): [bold]pipx install "openeye-sh\\[{extra}]" --force[/bold]\n'
        f"  [dim](Quotes required in zsh/fish due to bracket expansion)[/dim]"
    )


def dependency_error(model: str, exc: ImportError) -> None:
    extra = _EXTRAS.get(model, model)
    rprint(
        f"[red]Missing dependencies for '{model}': {exc.name or exc}[/red]\n"
        + _install_hint(extra)
    )
    raise typer.Exit(code=1)
