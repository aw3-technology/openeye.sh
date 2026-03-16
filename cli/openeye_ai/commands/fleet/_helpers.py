"""Shared HTTP helpers for fleet CLI commands."""

from __future__ import annotations

import os

import typer
from rich import print as rprint
from rich.console import Console

fleet_app = typer.Typer(help="Fleet & device management for edge AI.")

_BASE_URL = os.environ.get("OPENEYE_FLEET_URL", "http://localhost:8001")
_TOKEN = os.environ.get("OPENEYE_TOKEN", "")

err_console = Console(stderr=True)


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_TOKEN}",
        "Content-Type": "application/json",
    }


def _ensure_token() -> None:
    if not _TOKEN:
        rprint(
            "[red]Error: OPENEYE_TOKEN environment variable is not set.[/red]\n"
            "Set it with: [bold]export OPENEYE_TOKEN=<your-token>[/bold]"
        )
        raise typer.Exit(code=1)


def _request(method: str, path: str, data: dict | None = None) -> dict:
    import httpx

    _ensure_token()
    try:
        r = httpx.request(
            method,
            f"{_BASE_URL}{path}",
            headers=_headers(),
            json=data if data is not None else (None if method == "GET" else {}),
            timeout=30,
        )
        if r.status_code == 204:
            return {}
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError:
        rprint(f"[red]Error: Cannot connect to fleet server at {_BASE_URL}[/red]")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as exc:
        detail = ""
        try:
            detail = exc.response.json().get("detail", "")
        except Exception:
            pass
        rprint(f"[red]Error {exc.response.status_code}: {detail or exc.response.text[:200]}[/red]")
        raise typer.Exit(code=1)
    except httpx.TimeoutException:
        rprint("[red]Error: Request timed out[/red]")
        raise typer.Exit(code=1)


def _get(path: str) -> dict:
    return _request("GET", path)


def _post(path: str, data: dict | None = None) -> dict:
    return _request("POST", path, data)


def _put(path: str, data: dict | None = None) -> dict:
    return _request("PUT", path, data)


def _patch(path: str, data: dict) -> dict:
    return _request("PATCH", path, data)


def _delete(path: str, data: dict | None = None) -> dict:
    return _request("DELETE", path, data)
