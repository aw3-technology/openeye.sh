#!/usr/bin/env python3
"""OpenEye VLM Demo — OpenRouter Free Vision Models

Standalone demo that sends an image to OpenRouter's free VLM endpoints
and displays the reasoning result with Rich formatting.

Usage:
  # Default: analyse warehouse scene with Qwen3-VL
  python -m openeye_ai.demos.vlm_openrouter_demo

  # Custom image + prompt
  python -m openeye_ai.demos.vlm_openrouter_demo \
      --image photo.jpg --prompt "List every safety hazard you see"

  # Compare all free models side-by-side
  python -m openeye_ai.demos.vlm_openrouter_demo --all-models

Requires:
  pip install openai Pillow
  OPENROUTER_API_KEY in .env or environment
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import io
import os
import sys
import time
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

console = Console()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "qwen/qwen3-vl-235b:free"
DEFAULT_PROMPT = (
    "Describe what you see in this image in detail. "
    "Focus on objects, people, spatial layout, and any notable activities or hazards."
)

FREE_MODELS = [
    ("qwen/qwen3-vl-235b:free", "Qwen3-VL 235B"),
    ("qwen/qwen2.5-vl-72b-instruct:free", "Qwen2.5-VL 72B"),
    ("google/gemma-3-27b-it:free", "Gemma 3 27B"),
]

DEFAULT_IMAGE = "src/assets/demo/scene-warehouse.jpg"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_repo_root() -> Path:
    """Walk up from this file to find the repo root (contains src/)."""
    p = Path(__file__).resolve().parent
    for _ in range(8):
        if (p / "src").is_dir():
            return p
        p = p.parent
    return Path.cwd()


def _load_env() -> None:
    """Load .env from the repo root if python-dotenv is available."""
    env_file = _find_repo_root() / ".env"
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
        except ImportError:
            # Manual fallback — parse KEY=VALUE lines
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def _encode_image(path: Path, max_size: int = 1024) -> str:
    """Load an image, resize if needed, return base64 JPEG string."""
    from PIL import Image

    img = Image.open(path)
    if img.mode == "RGBA":
        img = img.convert("RGB")

    # Resize to keep API payload reasonable
    w, h = img.size
    if max(w, h) > max_size:
        ratio = max_size / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


async def _query_vlm(
    api_key: str,
    model: str,
    image_b64: str,
    prompt: str,
) -> tuple[str, float]:
    """Send image + prompt to OpenRouter and return (response_text, latency_s)."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "https://perceptify.dev",
            "X-Title": "OpenEye",
        },
    )

    t0 = time.monotonic()
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}",
                            "detail": "low",
                        },
                    },
                ],
            }
        ],
        max_tokens=400,
    )
    elapsed = time.monotonic() - t0

    text = response.choices[0].message.content or "(empty response)"
    return text, elapsed


# ---------------------------------------------------------------------------
# Single-model demo
# ---------------------------------------------------------------------------

async def _run_single(api_key: str, model: str, image_b64: str, prompt: str, image_label: str) -> None:
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
            text, elapsed = await _query_vlm(api_key, model, image_b64, prompt)
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


# ---------------------------------------------------------------------------
# All-models comparison
# ---------------------------------------------------------------------------

async def _run_all_models(api_key: str, image_b64: str, prompt: str, image_label: str) -> None:
    """Run all free models concurrently and display results in a table."""
    console.print(Panel(
        f"[bold green]*[/bold green] Image:  [bold]{image_label}[/bold]\n"
        f"[bold green]*[/bold green] Models: [bold]{len(FREE_MODELS)}[/bold] free VLMs\n"
        f"[bold green]*[/bold green] Prompt: [dim]{prompt[:80]}{'...' if len(prompt) > 80 else ''}[/dim]",
        title="[bold cyan]OpenEye VLM — Model Comparison[/bold cyan]",
        subtitle="[dim]OpenRouter[/dim]",
        border_style="cyan",
    ))

    results: list[tuple[str, str, str | None, float]] = []

    with console.status("[bold]Querying all models concurrently...[/bold]", spinner="dots"):
        tasks = []
        for model_id, model_name in FREE_MODELS:
            tasks.append(_query_vlm(api_key, model_id, image_b64, prompt))

        outcomes = await asyncio.gather(*tasks, return_exceptions=True)

        for (model_id, model_name), outcome in zip(FREE_MODELS, outcomes):
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


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------

def run_demo(args: argparse.Namespace) -> None:
    """Entry point called from the CLI command."""
    _load_env()

    # Validate API key
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        console.print(
            "[red]OPENROUTER_API_KEY not set.[/red]\n"
            "[yellow]Add it to your .env file or export it:[/yellow]\n"
            "  export OPENROUTER_API_KEY=sk-or-..."
        )
        sys.exit(1)

    # Validate openai package
    try:
        import openai  # noqa: F401
    except ImportError:
        console.print(
            "[red]The 'openai' package is required.[/red]\n"
            "[yellow]Install it:[/yellow]  pip install openai"
        )
        sys.exit(1)

    # Resolve image path
    image_path = Path(args.image)
    if not image_path.is_absolute():
        image_path = _find_repo_root() / image_path
    if not image_path.exists():
        console.print(f"[red]Image not found: {image_path}[/red]")
        sys.exit(1)

    image_label = image_path.name

    # Validate Pillow
    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        console.print(
            "[red]Pillow is required for image processing.[/red]\n"
            "[yellow]Install it:[/yellow]  pip install Pillow"
        )
        sys.exit(1)

    # Encode image
    with console.status("[bold]Encoding image...[/bold]"):
        image_b64 = _encode_image(image_path)
    console.print(f"[green]Image loaded:[/green] {image_label} ({len(image_b64) // 1024} KB encoded)")

    # Run
    if args.all_models:
        asyncio.run(_run_all_models(api_key, image_b64, args.prompt, image_label))
    else:
        asyncio.run(_run_single(api_key, args.model, image_b64, args.prompt, image_label))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="OpenEye VLM Demo — OpenRouter Free Vision Models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyse default warehouse scene
  python -m openeye_ai.demos.vlm_openrouter_demo

  # Custom image and prompt
  python -m openeye_ai.demos.vlm_openrouter_demo \\
      --image photo.jpg --prompt "List all safety hazards"

  # Try a different model
  python -m openeye_ai.demos.vlm_openrouter_demo \\
      --model google/gemma-3-27b-it:free

  # Compare all free models
  python -m openeye_ai.demos.vlm_openrouter_demo --all-models
        """,
    )

    parser.add_argument(
        "--image", default=DEFAULT_IMAGE,
        help=f"Path to image file (default: {DEFAULT_IMAGE})",
    )
    parser.add_argument(
        "--model", "-m", default=DEFAULT_MODEL,
        help=f"OpenRouter model ID (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--prompt", "-p", default=DEFAULT_PROMPT,
        help="Custom prompt to send with the image",
    )
    parser.add_argument(
        "--all-models", action="store_true",
        help="Compare all free VLM models side-by-side",
    )

    args = parser.parse_args()
    run_demo(args)


if __name__ == "__main__":
    main()
