"""Checksum computation and verification for model files."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from rich import print as rprint


def compute_checksum(filepath: Path, algo: str = "sha256") -> str:
    """Compute the hex digest of a file."""
    try:
        h = hashlib.new(algo)
    except ValueError:
        raise ValueError(f"Unsupported hash algorithm: {algo}")
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_checksum(model_dir: Path, filename: str, expected: dict[str, Any]) -> bool:
    """Verify a file's checksum against expected dict with 'algorithm' and 'value'.

    Returns True if checksum matches, False otherwise.
    """
    filepath = model_dir / filename
    if not filepath.exists():
        rprint(f"[red]Checksum failed: file not found {filepath}[/red]")
        return False

    algo = expected.get("algorithm", "sha256")
    expected_value = expected.get("value", "")
    if not expected_value:
        return True  # no expected value to compare

    actual = compute_checksum(filepath, algo)
    if actual != expected_value:
        rprint(
            f"[red]Checksum mismatch for {filename}![/red]\n"
            f"  Expected: {expected_value}\n"
            f"  Got:      {actual}"
        )
        return False
    rprint(f"[green]Checksum OK for {filename}[/green]")
    return True
