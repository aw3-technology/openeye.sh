"""MLOps commands — model lifecycle, A/B testing, batch inference, etc."""

from __future__ import annotations

import typer

from openeye_ai.commands.mlops.deploy import deploy_app
from openeye_ai.commands.mlops.evaluate import evaluate_app
from openeye_ai.commands.mlops.train import train_app

mlops_app = typer.Typer(help="Model lifecycle & MLOps operations.")

# Merge submodule commands into the flat mlops namespace.
for _sub in (train_app, deploy_app, evaluate_app):
    mlops_app.registered_commands.extend(_sub.registered_commands)
