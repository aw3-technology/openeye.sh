"""Training pipeline, retraining, annotations & feedback commands.

This module creates ``train_app`` and registers commands defined in the
focused submodules: :mod:`.pipeline`, :mod:`.batch`, and :mod:`.feedback`.
"""

from __future__ import annotations

import typer

from openeye_ai.commands.mlops.batch import mlops_batch_create
from openeye_ai.commands.mlops.feedback import (
    mlops_annotate,
    mlops_annotations,
    mlops_feedback,
    mlops_feedback_batches,
    mlops_feedback_generate,
)
from openeye_ai.commands.mlops.pipeline import (
    mlops_pipeline_create,
    mlops_pipelines,
    mlops_retrain,
    mlops_run_status,
    mlops_runs,
)

train_app = typer.Typer()

# ── Retraining Pipeline ──────────────────────────────────────────────
train_app.command("retrain")(mlops_retrain)
train_app.command("pipeline-create")(mlops_pipeline_create)
train_app.command("pipelines")(mlops_pipelines)
train_app.command("runs")(mlops_runs)
train_app.command("run-status")(mlops_run_status)

# ── Batch Inference ──────────────────────────────────────────────────
train_app.command("batch-create")(mlops_batch_create)

# ── Feedback & Annotations ───────────────────────────────────────────
train_app.command("feedback")(mlops_feedback)
train_app.command("annotate")(mlops_annotate)
train_app.command("feedback-generate")(mlops_feedback_generate)
train_app.command("annotations")(mlops_annotations)
train_app.command("feedback-batches")(mlops_feedback_batches)
