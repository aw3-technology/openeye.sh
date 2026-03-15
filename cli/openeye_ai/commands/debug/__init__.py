"""Visual debugger CLI commands — analyze, watch, and diff UI screenshots."""

from __future__ import annotations

import typer

debug_app = typer.Typer(help="Visual UI debugger — analyze screenshots, watch live apps, diff regressions.")

# Register sub-commands by importing their modules
from openeye_ai.commands.debug import screenshot as _screenshot  # noqa: F401, E402
from openeye_ai.commands.debug import watch as _watch  # noqa: F401, E402
from openeye_ai.commands.debug import diff as _diff  # noqa: F401, E402
