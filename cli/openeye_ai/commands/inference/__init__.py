"""Inference commands — run, bench, serve, watch."""

from openeye_ai.commands.inference.bench import bench
from openeye_ai.commands.inference.run import run
from openeye_ai.commands.inference.serve import serve
from openeye_ai.commands.inference.watch import watch

__all__ = ["bench", "run", "serve", "watch"]
