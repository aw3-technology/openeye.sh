"""Shared Typer app instance for all mlops subcommands."""

from __future__ import annotations

import typer

mlops_app = typer.Typer(help="Model lifecycle & MLOps operations.")
