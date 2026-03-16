"""Fleet CLI — subcommands are registered by importing each module."""

from ._helpers import fleet_app

# Import submodules to register their commands on fleet_app.
from . import agent  # noqa: F401
from . import alerts  # noqa: F401
from . import command_queue  # noqa: F401
from . import deployments  # noqa: F401
from . import devices  # noqa: F401
from . import groups  # noqa: F401
from . import maintenance  # noqa: F401

__all__ = ["fleet_app"]
