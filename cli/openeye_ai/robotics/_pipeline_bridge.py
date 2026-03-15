"""Bridge to backend/src/ — adds the perception pipeline to sys.path.

Delegates to the shared :mod:`openeye_ai._backend` helper.
"""

from __future__ import annotations

from openeye_ai._backend import ensure_backend_path

__all__ = ["ensure_backend_path"]
