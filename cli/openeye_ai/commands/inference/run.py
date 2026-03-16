"""Run command — single-image inference."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

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


def _format_pretty(result) -> str:
    """Format a PredictionResult as human-readable colored text for the terminal."""
    from rich.console import Console
    from rich.text import Text

    buf_console = Console(file=None, force_terminal=True, width=80)
    parts: list[str] = []

    # Header
    parts.append(f"\n[bold cyan]{result.model}[/bold cyan] [dim]({result.task})[/dim]")
    parts.append(
        f"[dim]Image:[/dim] {result.image.source} "
        f"[dim]({result.image.width}x{result.image.height})[/dim]"
    )
    parts.append(f"[dim]Inference:[/dim] [bold]{result.inference_ms:.1f} ms[/bold]")
    parts.append("")

    # Detections
    if result.objects:
        parts.append(f"[bold]Detections ({len(result.objects)}):[/bold]")
        for i, obj in enumerate(result.objects, 1):
            # Color confidence: green ≥0.8, yellow ≥0.5, red <0.5
            conf = obj.confidence
            if conf >= 0.8:
                color = "green"
            elif conf >= 0.5:
                color = "yellow"
            else:
                color = "red"
            bbox = obj.bbox
            px_x = int(bbox.x * result.image.width)
            px_y = int(bbox.y * result.image.height)
            px_w = int(bbox.w * result.image.width)
            px_h = int(bbox.h * result.image.height)
            parts.append(
                f"  {i:>2}. [bold]{obj.label:<15}[/bold] "
                f"[{color}]{conf:>6.1%}[/{color}]  "
                f"[dim][{px_x}, {px_y}, {px_w}, {px_h}][/dim]"
            )

    # Depth map
    if result.depth_map:
        depth_size = len(result.depth_map)
        parts.append(f"[bold]Depth Map:[/bold] [dim]{depth_size:,} bytes (base64)[/dim]")

    # Segmentation masks
    if result.segmentation_masks:
        parts.append(f"[bold]Segmentation Masks ({len(result.segmentation_masks)}):[/bold]")
        for i, mask in enumerate(result.segmentation_masks, 1):
            parts.append(
                f"  {i:>2}. area={mask.area:>8,}px  "
                f"stability={mask.stability_score:.2f}"
            )

    # VLA action
    if result.vla_action:
        action_str = ", ".join(f"{v:.3f}" for v in result.vla_action)
        parts.append(f"[bold]VLA Action:[/bold] [{action_str}]")

    parts.append("")
    return "\n".join(parts)


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


def _merge_pipeline(result, piped_data: dict):
    """Merge upstream pipeline results into the current result."""
    from openeye_ai.schema import DetectedObject, SegmentationMask

    upstream_objects = piped_data.get("objects", [])
    upstream_depth = piped_data.get("depth_map")
    upstream_masks = piped_data.get("segmentation_masks")
    upstream_vla = piped_data.get("vla_action")

    # Merge objects: keep current + upstream (no duplicates by position)
    if upstream_objects and not result.objects:
        result.objects = [DetectedObject(**o) for o in upstream_objects]

    # Merge depth: prefer current, fallback to upstream
    if upstream_depth and not result.depth_map:
        result.depth_map = upstream_depth

    # Merge masks: prefer current, fallback to upstream
    if upstream_masks and not result.segmentation_masks:
        result.segmentation_masks = [SegmentationMask(**m) for m in upstream_masks]

    # Merge VLA: prefer current, fallback to upstream
    if upstream_vla and not result.vla_action:
        result.vla_action = upstream_vla

    # Record pipeline provenance
    upstream_model = piped_data.get("model", "")
    if upstream_model:
        result.model = f"{upstream_model}+{result.model}"

    return result


def _save_visualization(result, img, image_path: Path) -> None:
    """Save annotated visualization based on result type."""
    from openeye_ai.utils.visualize import draw_boxes, draw_masks, save_depth_map

    try:
        if result.depth_map:
            depth_path = image_path.with_name(f"{image_path.stem}_depth.png")
            save_depth_map(result.depth_map, depth_path)
            rprint(f"[green]Depth map saved to {depth_path}[/green]", file=sys.stderr)
        if result.segmentation_masks:
            annotated = draw_masks(img, [m.model_dump() for m in result.segmentation_masks])
            mask_path = image_path.with_name(f"{image_path.stem}_masks.png")
            annotated.save(mask_path)
            rprint(f"[green]Segmentation masks saved to {mask_path}[/green]", file=sys.stderr)
        if result.objects:
            annotated = draw_boxes(img, [o.model_dump() for o in result.objects])
            annotated_path = image_path.with_name(f"{image_path.stem}_annotated.png")
            annotated.save(annotated_path)
            rprint(f"[green]Annotated image saved to {annotated_path}[/green]", file=sys.stderr)
        if not result.depth_map and not result.objects and not result.segmentation_masks:
            rprint("[yellow]No objects, depth map, or masks to visualize.[/yellow]", file=sys.stderr)
    except OSError as e:
        rprint(f"[red]Failed to save visualization: {e}[/red]", file=sys.stderr)


def run(
    model: str = typer.Argument(help="Model name (e.g. yolov8)"),
    image: Optional[str] = typer.Argument(None, help="Image path, directory, or '-' for stdin"),
    prompt: Optional[str] = typer.Option(None, "--prompt", "-p", help="Text prompt (for grounding-dino)"),
    pretty: bool = typer.Option(False, "--pretty", help="Human-readable colored output"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Write JSON output to file"),
    visualize: bool = typer.Option(False, "--visualize", help="Save annotated image with bounding boxes"),
    backend: Optional[str] = typer.Option(None, "--backend", "-b", help="Backend: onnx, tensorrt"),
    variant: Optional[str] = typer.Option(None, "--variant", help="Use a specific model variant"),
    confidence: Optional[float] = typer.Option(None, "--confidence", "-c", help="Minimum confidence threshold (0.0-1.0)"),
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
