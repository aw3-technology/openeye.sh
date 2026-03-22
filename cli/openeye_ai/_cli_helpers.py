"""Shared CLI helpers — consoles, constants, and utility functions."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import typer
from rich import print as rprint
from rich.console import Console

console = Console()
# Separate console for status/progress in commands whose primary output is JSON
# to stdout, so spinners don't corrupt piped output.
err_console = Console(stderr=True)

# ── Centralized server URLs ──────────────────────────────────────────
# All default ports/URLs in one place; each can be overridden by env var.

SERVER_URL = os.environ.get("OPENEYE_SERVER_URL", "http://localhost:8000")
API_URL = os.environ.get("OPENEYE_API_URL", "http://localhost:8001")
FLEET_URL = os.environ.get("OPENEYE_FLEET_URL", "http://localhost:8001")


# ── Backend sys.path helper ─────────────────────────────────────────

def ensure_backend_path() -> Path:
    """Add backend/src to sys.path for perception pipeline imports.

    Walks up from this file's location to find the repo root containing
    ``backend/src/perception``, inserts it into ``sys.path`` once, and
    returns the repo root.
    """
    candidate = Path(__file__).resolve().parent
    for _ in range(6):
        backend_src = candidate / "backend" / "src"
        if (backend_src / "perception").is_dir():
            src_str = str(backend_src)
            if src_str not in sys.path:
                sys.path.insert(0, src_str)
            return candidate
        candidate = candidate.parent
    rprint("[red]Cannot find backend/src/perception — run from the repo root[/red]")
    raise typer.Exit(code=1)

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


# ── Centralised HTTP request with error handling ───────────────────


def http_request(
    method: str,
    url: str,
    *,
    timeout: int = 30,
    **kwargs,
):
    """Make an HTTP request with standardised CLI error handling.

    Wraps :func:`httpx.request` and translates connection errors,
    HTTP status errors, and timeouts into user-friendly Rich messages
    followed by ``typer.Exit(code=1)``.

    All *kwargs* are forwarded verbatim to ``httpx.request`` (e.g.
    ``headers``, ``json``, ``data``, ``files``, ``params``).

    Returns the :class:`httpx.Response` on success.
    """
    import httpx

    try:
        r = httpx.request(method, url, timeout=timeout, **kwargs)
        r.raise_for_status()
        return r
    except httpx.ConnectError:
        rprint(f"[red]Cannot connect to {url}[/red]")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as exc:
        rprint(f"[red]Error {exc.response.status_code}: {exc.response.text[:200]}[/red]")
        raise typer.Exit(code=1)
    except httpx.TimeoutException:
        rprint("[red]Error: Request timed out[/red]")
        raise typer.Exit(code=1)
