"""CLI commands for OpenEye Govern — ``openeye govern``.

This package creates ``govern_app`` and registers commands from the
focused submodules: :mod:`.policy_commands`, :mod:`.audit_commands`,
and :mod:`.init_command`.
"""

from __future__ import annotations

import sys
from pathlib import Path

import typer

from openeye_ai.commands.governance.audit_commands import audit, violations
from openeye_ai.commands.governance.init_command import init
from openeye_ai.commands.governance.policy_commands import (
    disable,
    enable,
    load,
    ls,
    presets,
    status,
    validate,
)

# Ensure backend/src is importable
_BACKEND_SRC = str(Path(__file__).resolve().parents[4] / "backend" / "src")
if _BACKEND_SRC not in sys.path:
    sys.path.insert(0, _BACKEND_SRC)

govern_app = typer.Typer(
    name="govern",
    help="Visual governance layer — manage policies, presets, and audit trail.",
    no_args_is_help=True,
)

# ── Policy commands ──────────────────────────────────────────────────
govern_app.command("status")(status)
govern_app.command("ls")(ls)
govern_app.command("enable")(enable)
govern_app.command("disable")(disable)
govern_app.command("presets")(presets)
govern_app.command("load")(load)
govern_app.command("validate")(validate)

# ── Audit commands ───────────────────────────────────────────────────
govern_app.command("audit")(audit)
govern_app.command("violations")(violations)

# ── Init command ─────────────────────────────────────────────────────
govern_app.command("init")(init)
