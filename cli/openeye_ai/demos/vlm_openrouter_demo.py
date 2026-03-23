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
import os
import sys
from pathlib import Path

from rich.console import Console

from openeye_ai.demos._vlm_helpers import _encode_image, _find_repo_root, _load_env
from openeye_ai.demos._vlm_runners import _run_all_models, _run_single

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
        asyncio.run(_run_all_models(
            api_key, image_b64, args.prompt, image_label,
            free_models=FREE_MODELS, base_url=OPENROUTER_BASE_URL,
        ))
    else:
        asyncio.run(_run_single(
            api_key, args.model, image_b64, args.prompt, image_label,
            base_url=OPENROUTER_BASE_URL,
        ))


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
