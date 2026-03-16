"""Backward-compat shim — fleet CLI has moved to commands/fleet/."""

from openeye_ai.commands.fleet import fleet_app

__all__ = ["fleet_app"]
