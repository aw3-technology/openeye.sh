"""HTTP client for remote governance server communication."""
from __future__ import annotations

import httpx
import typer
from rich import print as rprint


class GovernanceClient:
    """Thin HTTP client for governance server endpoints."""

    def __init__(self, server: str, timeout: float = 5):
        self.server = server.rstrip("/")
        self.timeout = timeout

    def _request(self, method: str, path: str, **kwargs) -> dict | list:
        """Make HTTP request, raise typer.Exit on failure."""
        try:
            r = httpx.request(method, f"{self.server}{path}", timeout=self.timeout, **kwargs)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            rprint(f"[red]Error:[/red] {e}")
            raise typer.Exit(1)

    def get_status(self) -> dict:
        return self._request("GET", "/governance/status")

    def enable_policy(self, name: str) -> None:
        self._request("POST", f"/governance/policies/{name}/enable")

    def disable_policy(self, name: str) -> None:
        self._request("POST", f"/governance/policies/{name}/disable")

    def load_preset(self, name: str) -> None:
        self._request("POST", f"/governance/presets/{name}/load")

    def load_config_yaml(self, yaml_content: str) -> None:
        self._request("PUT", "/governance/config", json={"yaml": yaml_content})

    def get_audit(self, limit: int = 20) -> list:
        return self._request("GET", "/governance/audit", params={"limit": limit})

    def get_violations(self, limit: int = 20) -> list:
        return self._request("GET", "/governance/violations", params={"limit": limit})
