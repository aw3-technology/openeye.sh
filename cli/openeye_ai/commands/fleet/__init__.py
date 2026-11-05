"""Fleet CLI — subcommands are registered by importing each module."""

# Import submodules to register their commands on fleet_app.
from . import (
    agent,  # noqa: F401
    alerts,  # noqa: F401
    command_queue,  # noqa: F401
    deployments,  # noqa: F401
    devices,  # noqa: F401
    groups,  # noqa: F401
    maintenance,  # noqa: F401
)
from ._helpers import fleet_app

__all__ = ["fleet_app"]
