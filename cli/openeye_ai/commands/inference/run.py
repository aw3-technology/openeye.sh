"""``openeye run`` — single-image inference."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import typer
from rich import print as rprint

from openeye_ai._cli_helpers import err_console
from openeye_ai.commands.inference._helpers import load_adapter, resolve_model_dir, resolve_model_info

def run(
    model: str = typer.Argument(help="Model name (e.g. yolov8)"),
    image: Path | None = typer.Argument(None, help="Path to image file (use '-' or omit for stdin pipe)"),
    prompt: str | None = typer.Option(None, "--prompt", "-p", help="Text prompt (for grounding-dino)"),
    pretty: bool = typer.Option(False, "--pretty", help="Pretty-print JSON output"),
    output: Path | None = typer.Option(None, "--output", "-o", help="Write JSON output to file"),
    visualize: bool = typer.Option(False, "--visualize", help="Save annotated image with bounding boxes"),
    backend: str | None = typer.Option(None, "--backend", "-b", help="Backend: onnx, tensorrt"),
    variant: str | None = typer.Option(None, "--variant", help="Use a specific model variant"),
) -> None:
    """Run inference on an image and output unified JSON."""
    from PIL import Image, UnidentifiedImageError

    from openeye_ai.schema import ImageInfo, PredictionResult

    effective_variant = variant or backend
    info = resolve_model_info(model, effective_variant)
    model_dir = resolve_model_dir(model, effective_variant)

    # Resolve image source
    piped_data = None
    if image is not None and str(image) == "-":
        image = None

    if image is None:
        if sys.stdin.isatty():
            rprint("[red]No image provided. Pass a file path or pipe JSON from a previous run.[/red]")
            raise typer.Exit(code=1)
        raw = sys.stdin.read()
        try:
            piped_data = json.loads(raw)
            image = Path(piped_data["image"]["source"])
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            rprint(f"[red]Invalid piped JSON (expected {{\"image\": {{\"source\": \"...\"}}}}):[/red] {e}")
            raise typer.Exit(code=1)

    if not image.exists():
        rprint(f"[red]Image not found: {image}[/red]")
        raise typer.Exit(code=1)

    adapter = load_adapter(model, model_dir, info, variant=effective_variant)

    try:
        img = Image.open(image).convert("RGB")
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

    result = PredictionResult(
        model=model,
        task=info["task"],
        image=ImageInfo(width=w, height=h, source=str(image)),
        **result_data,
    )

    json_output = result.model_dump_json(indent=2 if pretty else None)

    if output is not None:
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json_output)
        except OSError as e:
            rprint(f"[red]Failed to write output file: {e}[/red]", file=sys.stderr)
            raise typer.Exit(code=1)
        rprint(f"[green]Results written to {output}[/green]", file=sys.stderr)

    if visualize:
        from openeye_ai.utils.visualize import draw_boxes, save_depth_map

        try:
            if result.depth_map:
                depth_path = image.with_name(f"{image.stem}_depth.png")
                save_depth_map(result.depth_map, depth_path)
                rprint(f"[green]Depth map saved to {depth_path}[/green]", file=sys.stderr)
            elif result.objects:
                annotated = draw_boxes(img, [o.model_dump() for o in result.objects])
                annotated_path = image.with_name(f"{image.stem}_annotated.png")
                annotated.save(annotated_path)
                rprint(f"[green]Annotated image saved to {annotated_path}[/green]", file=sys.stderr)
            else:
                rprint("[yellow]No objects or depth map to visualize.[/yellow]", file=sys.stderr)
        except OSError as e:
            rprint(f"[red]Failed to save visualization: {e}[/red]", file=sys.stderr)

    print(json_output)
