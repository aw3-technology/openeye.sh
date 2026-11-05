"""openeye docs — machine-readable CLI reference for AI agents.

The command reference is generated from the live Typer app, so command
names, positional arguments and options always match what the CLI really
accepts.  Only the surrounding prose (models, endpoints, env vars, MCP) is
hand-written.
"""

from __future__ import annotations

import json
from typing import Any

import typer

_INTRO = r"""# OpenEye CLI Reference

OpenEye is a CLI for vision AI models — pull, run, serve, and manage
computer-vision models from your terminal.  Think "Ollama for vision."

Install: `pipx install openeye-sh`

---

## Quick start

```bash
openeye pull yolov8              # download a model
openeye run yolov8 photo.jpg     # run inference on an image
openeye serve yolov8             # start REST/WebSocket API server
openeye bench yolov8             # benchmark latency & throughput
```

---

## Available models

| Key              | Task          | Description                                      |
|------------------|---------------|--------------------------------------------------|
| yolov8           | detection     | Real-time object detection — 80 COCO classes     |
| yolo26           | detection     | Latest YOLO generation — 80 COCO classes         |
| depth-anything   | depth         | Monocular depth estimation                       |
| grounding-dino   | detection     | Open-vocabulary detection with text prompts      |
| sam2             | segmentation  | Zero-shot segmentation via Segment Anything 2    |
| rfdetr           | detection     | Real-time detection transformer without NMS      |
| smolvla          | vla           | Vision-language-action model for robotic control |

Use `openeye list` to see download status, sizes, and hardware support.

---
"""

_OUTRO = r"""
---

## Server endpoints (when `openeye serve` is running)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/predict` | POST | Inference — multipart image upload, returns JSON |
| `/health` | GET | Server health and queue status |
| `/metrics` | GET | Prometheus metrics |
| `/ws/predict` | WS | Streaming inference |
| `/ws/perception` | WS | Real-time perception loop |
| `/ws/vlm` | WS | Vision Language Model reasoning |
| `/ws/agentic` | WS | Agentic loop (perceive → reason → act) |
| `/v1/detect` | POST | Hosted-API-compatible detection (1 credit; `confidence` form field) |
| `/v1/depth` | POST | Hosted-API-compatible depth estimation (2 credits) |
| `/v1/describe` | POST | Hosted-API-compatible VLM description (3 credits; `prompt` form field) |
| `/v1/models` | GET | List available API models |
| `/v1/usage` | GET | API usage and remaining credits |

`/v1/*` accepts `Authorization: Bearer oe_...` or `X-API-Key: oe_...`.

## Environment variables
| Variable | Description |
|----------|-------------|
| `OPENEYE_SERVER_URL` | Server URL for client commands (default: `http://localhost:8000`) |
| `OPENEYE_API_URL` | Hosted API URL (default: `https://openeye.sh`) |
| `OPENEYE_API_KEY` | API key for the hosted API (`openeye api ...`) |
| `OPENEYE_FLEET_URL` | Fleet control plane URL (default: `http://localhost:8001`) |
| `OPENEYE_TOKEN` | Auth token for `openeye fleet ...` |
| `OPENEYE_SERVER_API_KEY` | When set on `openeye serve`, the only key `/v1/*` accepts |

## Piping & composition
```bash
# pipe image bytes
cat photo.jpg | openeye run yolov8 -
# chain models
openeye run yolov8 photo.jpg | openeye run depth-anything -
# save annotated output
openeye run yolov8 photo.jpg --output result.jpg
```

## MCP server (for AI tool integration)
```bash
openeye-mcp   # starts MCP server over stdio
```
Tools: openeye_list, openeye_pull, openeye_run, openeye_serve,
       openeye_health, openeye_bench, openeye_remove, openeye_nebius_stats,
       openeye_api_detect, openeye_api_describe, openeye_api_models,
       openeye_api_usage
"""

_GROUP_TITLES = {
    "config": "Configuration",
    "fleet": "Fleet management",
    "mlops": "MLOps",
    "govern": "Governance",
    "agent": "Agent",
    "api": "Hosted API client",
}


def _root_command() -> Any:
    from openeye_ai.cli import app

    return typer.main.get_command(app)


# Duck-typed checks: recent Typer releases vendor their own copy of Click,
# so isinstance() against ``click.*`` classes is not reliable.
def _is_group(cmd: Any) -> bool:
    return hasattr(cmd, "list_commands") and hasattr(cmd, "get_command")


def _is_arg(param: Any) -> bool:
    return getattr(param, "param_type_name", "") == "argument"


def _is_opt(param: Any) -> bool:
    return getattr(param, "param_type_name", "") == "option"


def _usage(path: str, cmd: Any) -> str:
    """Build a one-line signature: positionals and required options."""
    parts = [path]
    for p in cmd.params:
        if _is_arg(p):
            token = f"<{(p.name or 'arg').replace('_', '-')}>"
            if p.nargs == -1:
                token += "..."
            parts.append(token if p.required else f"[{token}]")
        elif _is_opt(p) and p.required and not p.is_flag:
            flag = _long_flag(p)
            parts.append(f"{flag} <{flag.lstrip('-').upper()}>")
    return " ".join(parts)


def _long_flag(opt: Any) -> str:
    return max(opt.opts, key=len)


def _describe(cmd: Any) -> dict[str, Any]:
    return {
        "help": cmd.get_short_help_str(limit=200),
        "arguments": [
            {
                "name": p.name,
                "required": p.required,
                "variadic": p.nargs == -1,
            }
            for p in cmd.params
            if _is_arg(p)
        ],
        "options": [
            {
                "flags": list(p.opts) + list(p.secondary_opts),
                "required": p.required,
                "is_flag": p.is_flag,
                "help": p.help or "",
            }
            for p in cmd.params
            if _is_opt(p) and not p.hidden
        ],
    }


def collect_commands() -> list[dict[str, Any]]:
    """Walk the Typer app and return one record per leaf command."""
    root = _root_command()
    ctx = root.context_class(root, info_name="openeye")
    out: list[dict[str, Any]] = []

    def walk(group: Any, prefix: str, group_name: str | None) -> None:
        for name in group.list_commands(ctx):
            cmd = group.get_command(ctx, name)
            if cmd is None or cmd.hidden:
                continue
            path = f"{prefix} {name}"
            if _is_group(cmd):
                walk(cmd, path, group_name or name)
                continue
            rec = _describe(cmd)
            rec["command"] = path
            rec["group"] = group_name
            rec["usage"] = _usage(path, cmd)
            out.append(rec)

    walk(root, "openeye", None)
    return out


def _md_cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


def _commands_markdown(commands: list[dict[str, Any]]) -> str:
    groups: dict[str | None, list[dict[str, Any]]] = {}
    for c in commands:
        groups.setdefault(c["group"], []).append(c)

    lines = [
        "## Commands",
        "",
        "Generated from the installed CLI. `<arg>` is required, `[<arg>]` is",
        "optional; run `openeye <command> --help` for full option details.",
    ]
    order = [None] + sorted(k for k in groups if k is not None)
    for key in order:
        if key not in groups:
            continue
        title = (
            "Core commands"
            if key is None
            else f"{_GROUP_TITLES.get(key, key.title())} (`openeye {key} ...`)"
        )
        lines += ["", f"### {title}", "| Command | Description | Options |"]
        lines.append("|---------|-------------|---------|")
        for c in groups[key]:
            opts = ", ".join(f"`{f}`" for f in _optional_flags_from(c))
            lines.append(
                f"| `{_md_cell(c['usage'])}` | {_md_cell(c['help'])} | {opts} |"
            )
    return "\n".join(lines)


def _optional_flags_from(rec: dict[str, Any]) -> list[str]:
    return [
        max(o["flags"], key=len)
        for o in rec["options"]
        if not o["required"] and "--help" not in o["flags"]
    ]


def build_reference() -> str:
    """Return the full markdown reference."""
    return (
        _INTRO + "\n" + _commands_markdown(collect_commands()) + "\n" + _OUTRO
    ).strip()


def docs(
    machine: bool = typer.Option(
        False, "--json", "-j", help="Output as JSON for programmatic consumption"
    ),
) -> None:
    """Show full CLI reference — designed for AI agents and humans alike."""
    if machine:
        typer.echo(
            json.dumps(
                {"reference": build_reference(), "commands": collect_commands()},
                indent=2,
            )
        )
    else:
        # Plain echo: the reference contains [<arg>] which Rich would eat as markup.
        typer.echo(build_reference())
