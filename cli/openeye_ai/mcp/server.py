"""OpenEye MCP server.

Local tools wrap the ``openeye`` CLI via subprocess. Hosted tools call the
OpenEye API at https://openeye.sh/v1 (override with OPENEYE_API_URL) and need
OPENEYE_API_KEY in the server's environment.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from openeye_ai.mcp.tools import OPENEYE, run_cli

mcp = FastMCP(
    "openeye",
    instructions=(
        "Vision AI for agents. Local tools pull, run, serve and benchmark "
        "computer-vision models on this machine. Hosted tools (openeye_api_*) "
        "run detection and scene description on https://openeye.sh/v1 using "
        "OPENEYE_API_KEY; they cost credits."
    ),
)


# ── Tools ────────────────────────────────────────────────────────────────


@mcp.tool()
async def openeye_list() -> str:
    """List available and downloaded vision AI models."""
    result = await run_cli("list", timeout=30)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    # list prints a Rich table to stderr; stdout may be empty
    return result["stdout"] or result["stderr"]


@mcp.tool()
async def openeye_pull(model: str) -> str:
    """Download a vision AI model's weights.

    Args:
        model: Model key, e.g. 'yolov8', 'depth-anything', 'grounding-dino'.
    """
    result = await run_cli("pull", model, timeout=300)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    return (
        result["stdout"] or result["stderr"] or f"Model '{model}' pulled successfully."
    )


@mcp.tool()
async def openeye_run(
    model: str, image: str, prompt: str | None = None, pretty: bool = False
) -> str:
    """Run inference on an image and return detections as JSON.

    Args:
        model: Model key, e.g. 'yolov8'.
        image: Path to image file.
        prompt: Optional text prompt (for open-vocab models like grounding_dino).
        pretty: If true, return human-readable output instead of JSON.
    """
    args = ["run", model, image]
    if prompt:
        args.extend(["-p", prompt])
    if pretty:
        args.append("--pretty")

    result = await run_cli(*args, timeout=60)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"

    stdout = result["stdout"]
    # Try to parse as JSON for validation
    if not pretty:
        try:
            json.loads(stdout)
        except (json.JSONDecodeError, ValueError):
            pass  # Some output formats aren't pure JSON
    return stdout


@mcp.tool()
async def openeye_serve(model: str, port: int = 8000) -> str:
    """Start the OpenEye inference server in the background.

    Args:
        model: Model key to serve.
        port: Port to listen on (default 8000).
    """
    import asyncio

    args = ["serve", model, "--port", str(port)]
    proc = await asyncio.create_subprocess_exec(
        OPENEYE,
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    # Wait briefly for startup, then return
    try:
        await asyncio.wait_for(proc.wait(), timeout=3)
        # If it exited within 3s, it likely failed
        stderr = (await proc.stderr.read()).decode(errors="replace").strip()
        return f"Server exited immediately. Error: {stderr}"
    except asyncio.TimeoutError:
        # Still running — good
        return f"Server started on port {port} (PID {proc.pid}). Use openeye_health to verify."


@mcp.tool()
async def openeye_health(port: int = 8000) -> str:
    """Check if the OpenEye server is healthy.

    Args:
        port: Server port (default 8000).
    """
    import httpx

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"http://localhost:{port}/health", timeout=5)
            return resp.text
    except httpx.ConnectError:
        return f"Error: Cannot connect to server on port {port}. Is it running?"
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
async def openeye_bench(model: str, runs: int = 10) -> str:
    """Benchmark a model's inference speed.

    Args:
        model: Model key to benchmark.
        runs: Number of inference runs (default 10).
    """
    result = await run_cli("bench", model, "--runs", str(runs), timeout=120)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    return result["stdout"] or result["stderr"]


@mcp.tool()
async def openeye_remove(model: str) -> str:
    """Remove a downloaded model's weights from disk.

    Args:
        model: Model key to remove.
    """
    # Pipe 'y' to auto-confirm the deletion prompt
    result = await run_cli("remove", model, timeout=30, stdin_data="y\n")
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    return result["stdout"] or result["stderr"] or f"Model '{model}' removed."


@mcp.tool()
async def openeye_nebius_stats() -> str:
    """Get Nebius VLM usage statistics from the running server."""
    result = await run_cli("nebius-stats", timeout=15)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    return result["stdout"] or result["stderr"]


# ── Hosted API (https://openeye.sh/v1) ───────────────────────────────────


def _api_url() -> str:
    return os.environ.get("OPENEYE_API_URL", "https://openeye.sh").rstrip("/")


async def _api_call(
    method: str,
    path: str,
    *,
    image: str | None = None,
    data: dict | None = None,
    params: dict | None = None,
    timeout: float = 60,
) -> str:
    """Call the hosted API and return the JSON response (or an error) as text."""
    import httpx

    key = os.environ.get("OPENEYE_API_KEY", "")
    if not key:
        return (
            "Error: OPENEYE_API_KEY is not set. Create a key at "
            "https://openeye.sh/dashboard/settings/api-keys and add it to the "
            "MCP server's environment."
        )

    files = None
    if image is not None:
        path_obj = Path(image).expanduser()
        if not path_obj.is_file():
            return f"Error: image not found: {path_obj}"
        files = {"file": (path_obj.name, path_obj.read_bytes())}

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.request(
                method,
                f"{_api_url()}{path}",
                headers={"Authorization": f"Bearer {key}"},
                files=files,
                data=data,
                params=params,
            )
    except httpx.HTTPError as e:
        return f"Error: could not reach {_api_url()}: {e}"

    if resp.status_code >= 400:
        try:
            detail = resp.json().get("error", resp.text)
        except ValueError:
            detail = resp.text
        return f"Error {resp.status_code}: {detail}"
    return json.dumps(resp.json(), indent=2)


@mcp.tool()
async def openeye_api_detect(image_path: str, confidence: float = 0.25) -> str:
    """Detect objects in an image with the hosted OpenEye API (1 credit).

    Returns JSON with objects (label, confidence, bbox normalized 0-1 as
    x, y, w, h), image size and inference time.

    Args:
        image_path: Path to a JPEG or PNG under 4 MB.
        confidence: Minimum confidence 0-1 (default 0.25).
    """
    return await _api_call(
        "POST", "/v1/detect", image=image_path, data={"confidence": str(confidence)}
    )


@mcp.tool()
async def openeye_api_describe(
    image_path: str, prompt: str = "Describe what you see in this image."
) -> str:
    """Describe an image or answer a question about it with the hosted API (3 credits).

    Args:
        image_path: Path to a JPEG or PNG under 4 MB.
        prompt: Question or instruction for the vision-language model.
    """
    return await _api_call(
        "POST", "/v1/describe", image=image_path, data={"prompt": prompt}, timeout=120
    )


@mcp.tool()
async def openeye_api_models() -> str:
    """List hosted API models, their credit cost and whether each is available."""
    return await _api_call("GET", "/v1/models", timeout=15)


@mcp.tool()
async def openeye_api_usage(days: int = 30) -> str:
    """Show the hosted API credit balance and usage for the last N days.

    Args:
        days: Period to report, 1-365 (default 30).
    """
    return await _api_call("GET", "/v1/usage", params={"days": days}, timeout=15)


# ── Entry point ──────────────────────────────────────────────────────────


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
