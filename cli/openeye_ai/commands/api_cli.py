"""Hosted V1 API CLI commands — `openeye api ...`."""

from __future__ import annotations

import json
import os
from pathlib import Path

import typer
from rich import print as rprint
from rich.table import Table

from openeye_ai._cli_helpers import API_URL as _API_URL, err_console as console, http_request

api_app = typer.Typer(help="Hosted inference API — detect, describe, and manage credits.")
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
    confidence: float = typer.Option(0.25, "--confidence", "-c", help="Min confidence (0-1)"),
    server: str | None = typer.Option(None, "--server", "-s", help="API server URL"),
    pretty: bool = typer.Option(False, "--pretty", "-p", help="Pretty-print JSON output"),
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
        rprint(f"[green]{len(objects)} objects detected[/green] ({result.get('credits_used', 0)} credits)")
        for obj in objects:
            rprint(f"  {obj.get('label', '?')} ({obj.get('confidence', 0):.0%})")


# ── api depth ─────────────────────────────────────────────────────


@api_app.command("depth")
def api_depth(
    image: Path = typer.Argument(help="Path to image file"),
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

    rprint(f"[green]Depth estimation complete[/green] ({result.get('credits_used', 0)} credits)")
    rprint(f"  Shape: {result.get('width', '?')}x{result.get('height', '?')}")
    if result.get("output_path"):
        rprint(f"  Output: {result['output_path']}")


# ── api describe ──────────────────────────────────────────────────


@api_app.command("describe")
def api_describe(
    image: Path = typer.Argument(help="Path to image file"),
    prompt: str = typer.Option("Describe what you see in this image.", "--prompt", "-p", help="VLM prompt"),
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
) -> None:
    """List available hosted models and their credit costs."""
    url = _api_url(server)
    r = http_request("GET", f"{url}/v1/models", headers=_auth_headers(), timeout=10)
    models = r.json()

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

    table.add_row("Credits remaining", str(data.get("credits_remaining", "?")))
    table.add_row("Credits used", str(data.get("credits_used", "?")))
    table.add_row("Total calls", str(data.get("total_calls", "?")))
    table.add_row("Period", f"Last {days} days")

    if data.get("by_model"):
        for model_name, stats in data["by_model"].items():
            table.add_row(
                f"  {model_name}",
                f"{stats.get('calls', 0)} calls, {stats.get('credits', 0)} credits",
            )

    console.print(table)
