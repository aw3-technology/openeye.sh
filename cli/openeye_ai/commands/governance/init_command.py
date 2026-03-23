"""The ``govern init`` command — generate a starter YAML governance config."""

from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint

_DOMAIN_STARTERS: dict[str, list[dict]] = {
    "robotics": [
        {
            "name": "workspace_boundaries",
            "type": "zone_policy",
            "enabled": True,
            "severity": "critical",
            "enforcement": "enforce",
            "config": {
                "zones": [
                    {
                        "name": "danger_zone",
                        "level": "danger",
                        "shape": "circle",
                        "center": [0, 0, 0],
                        "radius_m": 0.5,
                        "on_violation": "halt",
                    }
                ]
            },
        },
        {
            "name": "dangerous_objects",
            "type": "object_restriction",
            "enabled": True,
            "severity": "high",
            "enforcement": "enforce",
            "config": {
                "deny_labels": ["knife", "scissors"],
                "deny_patterns": ["sharp", "weapon"],
                "on_violation": "deny",
            },
        },
        {
            "name": "action_safety",
            "type": "action_filter",
            "enabled": True,
            "severity": "high",
            "enforcement": "enforce",
            "config": {"deny_patterns": ["throw", "launch"]},
        },
    ],
    "desktop_agent": [
        {
            "name": "pii_protection",
            "type": "pii_filter",
            "enabled": True,
            "severity": "high",
            "enforcement": "enforce",
            "config": {
                "redact_patterns": [
                    {"type": "email", "action": "redact"},
                    {"type": "ssn", "action": "block_and_alert"},
                ],
            },
        },
        {
            "name": "interaction_limits",
            "type": "interaction_boundary",
            "enabled": True,
            "severity": "medium",
            "enforcement": "enforce",
            "config": {
                "denied_apps": [],
                "read_only_apps": ["banking"],
            },
        },
    ],
    "universal": [
        {
            "name": "action_safety",
            "type": "action_filter",
            "enabled": True,
            "severity": "high",
            "enforcement": "enforce",
            "config": {"deny_patterns": ["throw", "launch"]},
        },
    ],
}


def init(
    domain: str = typer.Option("robotics", "--domain", "-d", help="Domain: robotics | desktop_agent | universal"),
    output: str = typer.Option("governance.yaml", "--output", "-o", help="Output file path"),
) -> None:
    """Generate a starter YAML governance config."""
    import yaml

    policies = _DOMAIN_STARTERS.get(domain, _DOMAIN_STARTERS["universal"])

    config = {
        "version": "1.0",
        "name": "my-governance-config",
        "domain": domain,
        "extends": [],
        "policies": policies,
        "settings": {
            "log_all_decisions": True,
            "fail_open": False,
            "evaluation_timeout_ms": 50,
        },
    }

    path = Path(output)
    with open(path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    rprint(f"[green]Generated governance config:[/green] {path}")
    rprint(f"[dim]Edit the file to customize, then run: openeye govern validate {path}[/dim]")
