"""Run command — single-image inference."""

from __future__ import annotations

import sys
from pathlib import Path

import typer
from rich import print as rprint

from openeye_ai._cli_helpers import dependency_error, err_console
from openeye_ai.config import MODELS_DIR
from openeye_ai.registry import (
    get_adapter,
    get_model_info,
    get_variant_info,
    is_downloaded,
    is_variant_downloaded,
)

from openeye_ai.commands.inference.stdin_resolver import _resolve_stdin, _IMAGE_EXTENSIONS, _collect_images
from openeye_ai.commands.inference.result_formatter import _format_pretty, _merge_pipeline, _save_visualization


def _run_single(
    model: str,
    image_path: Path,
    adapter,
    info: dict,
    prompt: str | None,
    confidence: float | None,
    pretty: bool,
    output: Path | None,
    visualize: bool,
    piped_data: dict | None,
) -> str:
    """Run inference on a single image and return JSON output string."""
    import json

    from PIL import Image, UnidentifiedImageError

    from openeye_ai.schema import ImageInfo, PredictionResult

    try:
        img = Image.open(image_path).convert("RGB")
    except (UnidentifiedImageError, Exception) as e:
        rprint(f"[red]Cannot open image: {e}[/red]")
        raise typer.Exit(code=1)
    w, h = img.size

    try:
        with err_console.status("Running inference..."):
            if prompt and hasattr(adapter, "predict_with_prompt"):
                result_data = adapter.predict_with_prompt(img, prompt)
            else:
                result_data = adapter.predict(img)
    except Exception as e:
        rprint(f"[red]Inference failed: {e}[/red]")
        raise typer.Exit(code=1)

    # Apply confidence filter
    if confidence is not None and "objects" in result_data:
        result_data["objects"] = [
            o for o in result_data["objects"] if o.get("confidence", 0) >= confidence
        ]

    result = PredictionResult(
        model=model,
        task=info["task"],
        image=ImageInfo(width=w, height=h, source=str(image_path)),
        **result_data,
    )

    # Pipeline composition: merge upstream results
    if piped_data is not None:
        result = _merge_pipeline(result, piped_data)

    # File output
    json_output = result.model_dump_json(indent=2 if (pretty or output) else None)

    if output is not None:
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json_output)
        except OSError as e:
            rprint(f"[red]Failed to write output file: {e}[/red]", file=sys.stderr)
            raise typer.Exit(code=1)
        rprint(f"[green]Results written to {output}[/green]", file=sys.stderr)

    # Visualization
    if visualize:
        _save_visualization(result, img, image_path)

    # Pretty output to stderr, JSON to stdout
    if pretty:
        rprint(_format_pretty(result), file=sys.stderr)

    return result.model_dump_json(indent=None)


def run(
    model: str = typer.Argument(help="Model name (e.g. yolov8)"),
    image: str | None = typer.Argument(None, help="Image path, directory, or '-' for stdin"),
    prompt: str | None = typer.Option(None, "--prompt", "-p", help="Text prompt (for grounding-dino)"),
    pretty: bool = typer.Option(False, "--pretty", help="Human-readable colored output"),
    output: Path | None = typer.Option(None, "--output", "-o", help="Write JSON output to file"),
    visualize: bool = typer.Option(False, "--visualize", help="Save annotated image with bounding boxes"),
    backend: str | None = typer.Option(None, "--backend", "-b", help="Backend: onnx, tensorrt"),
    variant: str | None = typer.Option(None, "--variant", help="Use a specific model variant"),
    confidence: float | None = typer.Option(None, "--confidence", "-c", help="Minimum confidence threshold (0.0-1.0)"),
) -> None:
    """Run inference on an image (or directory of images) and output unified JSON."""
    import json

    # ── Resolve model & variant ──────────────────────────────────────
    effective_variant = variant
    if backend and not effective_variant:
        effective_variant = backend

    try:
        if effective_variant:
            info = get_variant_info(model, effective_variant)
        else:
            info = get_model_info(model)
    except KeyError as e:
        rprint(f"[red]{e}[/red]")
        raise typer.Exit(code=1)

    if effective_variant:
        model_dir = MODELS_DIR / model / f".variant-{effective_variant}"
        if not is_variant_downloaded(model, effective_variant):
            rprint(f"[yellow]Variant '{effective_variant}' not downloaded. Run: openeye pull {model} --variant {effective_variant}[/yellow]")
            raise typer.Exit(code=1)
    else:
        model_dir = MODELS_DIR / model
        if not is_downloaded(model):
            rprint(f"[yellow]Model '{model}' not downloaded. Run: openeye pull {model}[/yellow]")
            raise typer.Exit(code=1)

    # ── Resolve image source ─────────────────────────────────────────
    piped_data = None
    image_path: Path | None = None
    batch_paths: list[Path] | None = None

    if image is not None and image != "-":
        p = Path(image)
        if p.is_dir():
            batch_paths = _collect_images(p)
            if not batch_paths:
                rprint(f"[red]No image files found in directory: {p}[/red]")
                raise typer.Exit(code=1)
            err_console.print(f"[dim]Found {len(batch_paths)} images in {p}[/dim]")
        elif not p.exists():
            rprint(f"[red]Image not found: {p}[/red]")
            raise typer.Exit(code=1)
        else:
            image_path = p

    if image is None or image == "-":
        if sys.stdin.isatty():
            rprint("[red]No image provided. Pass a file path or pipe data from a previous run.[/red]")
            rprint("[dim]  Usage: openeye run yolov8 photo.jpg[/dim]")
            rprint("[dim]         cat photo.jpg | openeye run yolov8 -[/dim]")
            rprint("[dim]         openeye run yolov8 photo.jpg | openeye run depth-anything -[/dim]")
            raise typer.Exit(code=1)
        image_path, piped_data, _ = _resolve_stdin()

    if not image_path and not batch_paths:
        rprint("[red]No valid image source resolved.[/red]")
        raise typer.Exit(code=1)

    # ── Load adapter ─────────────────────────────────────────────────
    try:
        adapter = get_adapter(model, variant=effective_variant)
    except ImportError as e:
        dependency_error(model, e)

    try:
        with err_console.status(f"Loading {info['name']}..."):
            adapter.load(model_dir)
    except ImportError as e:
        dependency_error(model, e)
    except Exception as e:
        rprint(f"[red]Failed to load model: {e}[/red]")
        raise typer.Exit(code=1)

    # ── Single image inference ───────────────────────────────────────
    if image_path and not batch_paths:
        json_str = _run_single(
            model, image_path, adapter, info, prompt,
            confidence, pretty, output, visualize, piped_data,
        )
        print(json_str)
        return

    # ── Batch inference (directory) ──────────────────────────────────
    results: list[str] = []
    for i, img_path in enumerate(batch_paths):
        err_console.print(f"[dim][{i + 1}/{len(batch_paths)}] {img_path.name}[/dim]")
        try:
            json_str = _run_single(
                model, img_path, adapter, info, prompt,
                confidence, pretty, None, visualize, None,
            )
            results.append(json_str)
        except (typer.Exit, SystemExit):
            rprint(f"[yellow]Skipping {img_path.name} (error)[/yellow]", file=sys.stderr)

    # Output batch results as JSON array
    batch_output = "[" + ",".join(results) + "]"

    if output is not None:
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            if pretty:
                parsed = json.loads(batch_output)
                output.write_text(json.dumps(parsed, indent=2))
            else:
                output.write_text(batch_output)
        except OSError as e:
            rprint(f"[red]Failed to write output file: {e}[/red]", file=sys.stderr)
            raise typer.Exit(code=1)
        rprint(f"[green]Batch results written to {output}[/green]", file=sys.stderr)

    print(batch_output)
