"""Hosted V1 API CLI commands — `openeye api ...`."""

from __future__ import annotations

import json
import os
from pathlib import Path

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import API_URL as _API_URL
from openeye_ai._cli_helpers import console, http_request

api_app = typer.Typer(
    help="Hosted inference API — detect, describe, and manage credits."
)
_API_KEY = os.environ.get("OPENEYE_API_KEY", "")


def _api_url(server: str | None) -> str:
    return server or _API_URL


def _ensure_key() -> str:
    if not _API_KEY:
        rprint(
            "[red]Error: OPENEYE_API_KEY is not set.[/red]\n"
            "Set it with: [bold]export OPENEYE_API_KEY=oe_...[/bold]"
        )
        raise typer.Exit(code=1)
    return _API_KEY


def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {_ensure_key()}"}


# ── api detect ────────────────────────────────────────────────────


@api_app.command("detect")
def api_detect(
    image: Path = typer.Argument(help="Path to image file"),
    confidence: float = typer.Option(
        0.25, "--confidence", "-c", help="Min confidence (0-1)"
    ),
    server: str | None = typer.Option(None, "--server", "-s", help="API server URL"),
    pretty: bool = typer.Option(
        False, "--pretty", "-p", help="Pretty-print JSON output"
    ),
) -> None:
    """Run object detection on an image via the hosted API."""
    url = _api_url(server)
    if not image.exists():
        rprint(f"[red]File not found: {image}[/red]")
        raise typer.Exit(code=1)

    with open(image, "rb") as f:
        r = http_request(
            "POST",
            f"{url}/v1/detect",
            headers=_auth_headers(),
            files={"file": (image.name, f, "image/*")},
            data={"confidence": str(confidence)},
            timeout=30,
        )
    result = r.json()

    if pretty:
        rprint(json.dumps(result, indent=2))
    else:
        objects = result.get("objects", [])
        rprint(
            f"[green]{len(objects)} objects detected[/green] ({result.get('credits_used', 0)} credits)"
        )
        for obj in objects:
            rprint(f"  {obj.get('label', '?')} ({obj.get('confidence', 0):.0%})")


# ── api depth ─────────────────────────────────────────────────────


@api_app.command("depth")
def api_depth(
    image: Path = typer.Argument(help="Path to image file"),
    output: Path | None = typer.Option(
        None, "--output", "-o", help="Save the returned depth map PNG to this path"
    ),
    server: str | None = typer.Option(None, "--server", "-s", help="API server URL"),
) -> None:
    """Run depth estimation on an image via the hosted API."""
    url = _api_url(server)
    if not image.exists():
        rprint(f"[red]File not found: {image}[/red]")
        raise typer.Exit(code=1)

    with open(image, "rb") as f:
        r = http_request(
            "POST",
            f"{url}/v1/depth",
            headers=_auth_headers(),
            files={"file": (image.name, f, "image/*")},
            timeout=30,
        )
    result = r.json()

    rprint(
        f"[green]Depth estimation complete[/green] ({result.get('credits_used', 0)} credits)"
    )
    info = result.get("image") or {}
    width = info.get("width", result.get("width", "?"))
    height = info.get("height", result.get("height", "?"))
    rprint(f"  Image: {width}x{height}")
    if result.get("model"):
        rprint(f"  Model: {result['model']}")

    depth_map = result.get("depth_map")
    if not depth_map:
        rprint("  [yellow]No depth map returned[/yellow]")
    elif output is not None:
        from openeye_ai.utils.visualize import save_depth_map

        try:
            save_depth_map(depth_map, output)
        except OSError as exc:
            rprint(f"[red]Could not save depth map: {exc}[/red]")
            raise typer.Exit(code=1)
        rprint(f"  Saved depth map: {output}")
    else:
        rprint(
            f"  Depth map: {len(depth_map)} bytes (base64 PNG; use --output to save)"
        )


# ── api describe ──────────────────────────────────────────────────


@api_app.command("describe")
def api_describe(
    image: Path = typer.Argument(help="Path to image file"),
    prompt: str = typer.Option(
        "Describe what you see in this image.", "--prompt", "-p", help="VLM prompt"
    ),
    server: str | None = typer.Option(None, "--server", "-s", help="API server URL"),
) -> None:
    """Get a VLM scene description via the hosted API."""
    url = _api_url(server)
    if not image.exists():
        rprint(f"[red]File not found: {image}[/red]")
        raise typer.Exit(code=1)

    with open(image, "rb") as f:
        r = http_request(
            "POST",
            f"{url}/v1/describe",
            headers=_auth_headers(),
            files={"file": (image.name, f, "image/*")},
            data={"prompt": prompt},
            timeout=60,
        )
    result = r.json()

    rprint(f"[green]Description[/green] ({result.get('credits_used', 0)} credits):")
    rprint(result.get("description", "—"))


# ── api models ────────────────────────────────────────────────────


@api_app.command("models")
def api_models(
    server: str | None = typer.Option(None, "--server", "-s", help="API server URL"),
    as_json: bool = typer.Option(False, "--json", help="Print the raw JSON response"),
) -> None:
    """List available hosted models and their credit costs."""
    url = _api_url(server)
    r = http_request("GET", f"{url}/v1/models", headers=_auth_headers(), timeout=10)
    models = r.json()

    if as_json:
        typer.echo(json.dumps(models, indent=2))
        return

    table = Table(title="Hosted Models")
    table.add_column("Model", style="cyan")
    table.add_column("Task")
    table.add_column("Credits/call", justify="right", style="yellow")
    table.add_column("Description")

    for m in models if isinstance(models, list) else models.get("models", []):
        table.add_row(
            m.get("name", "?"),
            m.get("task", "?"),
            str(m.get("credits_per_call", "?")),
            m.get("description", ""),
        )

    console.print(table)


# ── api usage ─────────────────────────────────────────────────────


@api_app.command("usage")
def api_usage(
    days: int = typer.Option(30, "--days", "-d", help="Usage history window (days)"),
    server: str | None = typer.Option(None, "--server", "-s", help="API server URL"),
) -> None:
    """Show credit balance and usage statistics."""
    url = _api_url(server)
    r = http_request(
        "GET",
        f"{url}/v1/usage",
        headers=_auth_headers(),
        params={"days": days},
        timeout=10,
    )
    data = r.json()

    table = Table(title="API Usage", show_header=False)
    table.add_column("Field", style="cyan")
    table.add_column("Value")

    def _first(*keys: str):
        for k in keys:
            if data.get(k) is not None:
                return data[k]
        return "?"

    table.add_row("Credits remaining", str(_first("credits_remaining", "balance")))
    table.add_row("Credits used", str(_first("credits_used", "total_credits_used")))
    table.add_row("Total calls", str(_first("total_calls", "total_requests")))
    table.add_row("Period", f"Last {days} days")

    by_endpoint = data.get("by_endpoint") or {}
    if by_endpoint:
        table.add_row("Calls by endpoint", "")
        for endpoint, calls in sorted(by_endpoint.items()):
            table.add_row(f"  {endpoint}", f"{calls} calls")
    if data.get("truncated"):
        table.add_row("Note", "History truncated")

    console.print(table)
