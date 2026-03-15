"""Fleet & Device Management CLI commands — `openeye fleet ...`."""

from __future__ import annotations

import typer

fleet_app = typer.Typer(help="Fleet & device management for edge AI.")

# Register sub-commands by importing their modules
from openeye_ai.fleet_cli import devices as _devices  # noqa: F401, E402
from openeye_ai.fleet_cli import deployments as _deployments  # noqa: F401, E402
from openeye_ai.fleet_cli import groups as _groups  # noqa: F401, E402
from openeye_ai.fleet_cli import agent as _agent  # noqa: F401, E402
