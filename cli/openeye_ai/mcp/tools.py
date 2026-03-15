"""Async subprocess runner for OpenEye CLI commands."""

from __future__ import annotations

import asyncio
import shutil
import sys
from pathlib import Path


def _resolve_binary() -> str:
    """Find the ``openeye`` binary.

    Checks the current venv first, then falls back to PATH lookup.
    """
    venv_bin = Path(sys.prefix) / "bin" / "openeye"
    if venv_bin.exists():
        return str(venv_bin)

    found = shutil.which("openeye")
    if found:
        return found

    raise FileNotFoundError(
        "Could not find the 'openeye' binary. "
        "Install it with: pip install -e '.[all]'"
    )


OPENEYE = _resolve_binary()


async def run_cli(
    *args: str,
    timeout: float = 60,
    stdin_data: str | None = None,
) -> dict:
    """Run an ``openeye`` subcommand and return structured output.

    Returns a dict with keys ``returncode``, ``stdout``, ``stderr``.
    """
    proc = await asyncio.create_subprocess_exec(
        OPENEYE,
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
