"""Stdin resolution and image collection helpers for inference."""

from __future__ import annotations

import sys
from pathlib import Path

import typer
from rich import print as rprint

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}


def _resolve_stdin(*, allow_raw: bool = True):
    """Read stdin and return (image_path | None, piped_data | None, raw_bytes | None).

    Supports two stdin modes:
    1. JSON from a previous openeye run (pipeline composition)
    2. Raw image bytes (e.g. ``cat photo.jpg | openeye run yolov8 -``)
    """
    import json
    import tempfile

    raw = sys.stdin.buffer.read()
    if not raw:
        rprint("[red]No data received on stdin.[/red]")
        raise typer.Exit(code=1)

    # Try JSON first (pipeline composition)
    try:
        text = raw.decode("utf-8")
        piped_data = json.loads(text)
        image_path = Path(piped_data["image"]["source"])
        return image_path, piped_data, None
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError):
        pass

    # Raw image bytes — write to temp file
    if not allow_raw:
        rprint("[red]Invalid piped data. Expected JSON from a previous openeye run.[/red]")
        raise typer.Exit(code=1)

    try:
        from PIL import Image

        import io

        Image.open(io.BytesIO(raw)).verify()
    except Exception:
        rprint("[red]Stdin is not valid JSON or a recognized image format.[/red]")
        raise typer.Exit(code=1)

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp.write(raw)
    tmp.flush()
    tmp.close()
    return Path(tmp.name), None, raw


def _collect_images(directory: Path) -> list[Path]:
    """Collect image files from a directory, sorted by name."""
    images = sorted(
        p for p in directory.iterdir() if p.is_file() and p.suffix.lower() in _IMAGE_EXTENSIONS
    )
    return images
