"""Deployment commands — registry, promotion, A/B testing, shadow, export."""

from __future__ import annotations

import typer

from .ab_test import mlops_ab_tests, mlops_complete_ab_test, mlops_create_ab_test
from .export_cmd import mlops_export, mlops_exports, mlops_lineage
from .promotion import mlops_approve_promotion, mlops_promote, mlops_reject_promotion
from .registry import mlops_registry, mlops_upload, mlops_versions
from .shadow import mlops_shadow_mode, mlops_shadow_status

deploy_app = typer.Typer()

# ── Registry ──────────────────────────────────────────────────────────
deploy_app.command("upload")(mlops_upload)
deploy_app.command("registry")(mlops_registry)
deploy_app.command("versions")(mlops_versions)

# ── Promotion ─────────────────────────────────────────────────────────
deploy_app.command("promote")(mlops_promote)
deploy_app.command("approve-promotion")(mlops_approve_promotion)
deploy_app.command("reject-promotion")(mlops_reject_promotion)

# ── A/B Testing ───────────────────────────────────────────────────────
deploy_app.command("create-ab-test")(mlops_create_ab_test)
deploy_app.command("ab-tests")(mlops_ab_tests)
deploy_app.command("complete-ab-test")(mlops_complete_ab_test)

# ── Shadow Mode ───────────────────────────────────────────────────────
deploy_app.command("shadow-mode")(mlops_shadow_mode)
deploy_app.command("shadow-status")(mlops_shadow_status)

# ── Export + Lineage ──────────────────────────────────────────────────
deploy_app.command("export")(mlops_export)
deploy_app.command("exports")(mlops_exports)
deploy_app.command("lineage")(mlops_lineage)
