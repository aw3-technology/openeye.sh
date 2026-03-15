"""OpenEye MCP server — 8 tools wrapping the CLI via subprocess."""

from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP

from openeye_ai.mcp.tools import OPENEYE, run_cli

mcp = FastMCP(
    "openeye",
    instructions="Vision AI model management — pull, run, serve, and benchmark computer-vision models.",
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
        model: Model key, e.g. 'yolov8', 'depth_anything', 'grounding_dino'.
    """
    result = await run_cli("pull", model, timeout=300)
    if result["returncode"] != 0:
        return f"Error: {result['stderr']}"
    return result["stdout"] or result["stderr"] or f"Model '{model}' pulled successfully."


@mcp.tool()
async def openeye_run(model: str, image: str, prompt: str | None = None, pretty: bool = False) -> str:
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
        OPENEYE, *args,
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


# ── Entry point ──────────────────────────────────────────────────────────

def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
