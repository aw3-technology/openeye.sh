"""Async subprocess runner for OpenEye CLI commands."""

from __future__ import annotations

import asyncio
import functools
import shutil
import sysconfig


@functools.cache
def openeye_binary() -> str:
    """Find the ``openeye`` binary.

    Checks this interpreter's scripts dir first (``bin/`` on POSIX,
    ``Scripts\\`` on Windows), then PATH. Resolved on first use so the hosted
    ``openeye_api_*`` tools work even when the CLI isn't installed.
    """
    found = shutil.which("openeye", path=sysconfig.get_path("scripts"))
    found = found or shutil.which("openeye")
    if found:
        return found

    raise FileNotFoundError(
        "Could not find the 'openeye' binary. Install it with: "
        'pipx install "openeye-sh[mcp]"'
    )


async def run_cli(
    *args: str,
    timeout: float = 60,
    stdin_data: str | None = None,
) -> dict:
    """Run an ``openeye`` subcommand and return structured output.

    Returns a dict with keys ``returncode``, ``stdout``, ``stderr``.
    """
    try:
        binary = openeye_binary()
    except FileNotFoundError as exc:
        return {"returncode": -1, "stdout": "", "stderr": str(exc)}
    proc = await asyncio.create_subprocess_exec(
        binary,
        *args,
        stdin=asyncio.subprocess.PIPE if stdin_data else asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(input=stdin_data.encode() if stdin_data else None),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": f"Command timed out after {timeout}s",
        }

    return {
        "returncode": proc.returncode,
        "stdout": stdout_bytes.decode(errors="replace").strip(),
        "stderr": stderr_bytes.decode(errors="replace").strip(),
    }
