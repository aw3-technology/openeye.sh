"""Result formatting, pipeline merging, and visualization helpers for inference."""

from __future__ import annotations

import sys
from pathlib import Path

from rich import print as rprint


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
            # Color confidence: green >=0.8, yellow >=0.5, red <0.5
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
