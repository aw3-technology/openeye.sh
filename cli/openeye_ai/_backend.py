"""Shared helper to put ``backend/src`` on *sys.path*.

Every CLI / server module that needs to import from the ``perception``,
``fleet``, or ``governance`` packages should call :func:`ensure_backend_path`
instead of manually manipulating *sys.path*.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Walk upward from this file to locate the repo root (contains backend/src).
_THIS = Path(__file__).resolve()
_BACKEND_SRC: str | None = None
_candidate = _THIS.parent
for _ in range(6):
    if (_candidate / "backend" / "src").is_dir():
        _BACKEND_SRC = str(_candidate / "backend" / "src")
        break
    _candidate = _candidate.parent


def ensure_backend_path() -> str:
    """Ensure ``backend/src`` is on *sys.path* and return the resolved path.

    Raises *RuntimeError* if the ``backend/src`` directory cannot be located.
    """
    if _BACKEND_SRC is None:
        raise RuntimeError(
            "Cannot find backend/src — run from the repository root."
        )
    if _BACKEND_SRC not in sys.path:
        sys.path.insert(0, _BACKEND_SRC)
    return _BACKEND_SRC
