"""Shadow mode deployment (story 191).

Run a new model alongside production without serving results, to compare outputs.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import (
    ShadowComparisonMetrics,
    ShadowDeployment,
    ShadowDeploymentConfig,
    ShadowStatus,
)

_SHADOW_PATH = OPENEYE_HOME / "shadow_deployments.yaml"


def _load_deployments() -> list[dict]:
    return safe_load_yaml_list(_SHADOW_PATH)


def _save_deployments(deployments: list[dict]) -> None:
    atomic_save_yaml(_SHADOW_PATH, deployments)


def create_shadow_deployment(config: ShadowDeploymentConfig) -> ShadowDeployment:
    """Create and start a new shadow mode deployment."""
    deployment = ShadowDeployment(
        id=f"shadow-{uuid.uuid4().hex[:8]}",
        config=config,
        status=ShadowStatus.ACTIVE,
        comparison=ShadowComparisonMetrics(
            production_version=config.production_version,
            shadow_version=config.shadow_version,
        ),
    )

    deployments = _load_deployments()
    deployments.append(deployment.model_dump())
    _save_deployments(deployments)
    return deployment


def get_shadow_deployment(deployment_id: str) -> ShadowDeployment:
    """Get a shadow deployment by ID."""
    deployments = _load_deployments()
    for d in deployments:
        if d["id"] == deployment_id:
            return ShadowDeployment(**d)
    raise KeyError(f"Shadow deployment '{deployment_id}' not found.")


def list_shadow_deployments(model_key: Optional[str] = None) -> list[ShadowDeployment]:
    """List shadow deployments."""
    deployments = _load_deployments()
    result = [ShadowDeployment(**d) for d in deployments]
    if model_key:
        result = [r for r in result if r.config.model_key == model_key]
    return result


def run_shadow_inference(
    deployment_id: str,
    image: "Image.Image",
    production_adapter,
    shadow_adapter,
    *,
    sample_id: str = "",
) -> dict[str, Any]:
    """Run inference on both production and shadow models.

    Only the production result is returned for serving. The shadow result
    is used for comparison metrics only.
    """
    import random

    deployments = _load_deployments()
    dep_idx = -1
    dep_data = None

    for i, d in enumerate(deployments):
        if d["id"] == deployment_id:
            dep_data = d
            dep_idx = i
            break

    if dep_data is None:
        raise KeyError(f"Shadow deployment '{deployment_id}' not found.")

    deployment = ShadowDeployment(**dep_data)

    if deployment.status != ShadowStatus.ACTIVE:
        # Only run production model
        return production_adapter.predict(image)

    # Check sample rate
    if random.random() > deployment.config.sample_rate:
        return production_adapter.predict(image)

    # Run both models
    t0 = time.perf_counter()
    prod_result = production_adapter.predict(image)
    prod_latency = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    shadow_result = shadow_adapter.predict(image)
    shadow_latency = (time.perf_counter() - t0) * 1000

    # Update comparison metrics
    comp = deployment.comparison
    n = comp.total_samples
    comp.total_samples = n + 1
    comp.production_mean_latency_ms = (comp.production_mean_latency_ms * n + prod_latency) / (n + 1)
    comp.shadow_mean_latency_ms = (comp.shadow_mean_latency_ms * n + shadow_latency) / (n + 1)

    # Check agreement (same labels detected)
    prod_labels = {o["label"] for o in prod_result.get("objects", [])}
    shadow_labels = {o["label"] for o in shadow_result.get("objects", [])}
    agreed = prod_labels == shadow_labels
    comp.agreement_rate = (comp.agreement_rate * n + (1.0 if agreed else 0.0)) / (n + 1)

    if not agreed and sample_id:
        comp.divergent_samples.append(sample_id)
        # Keep only last 100 divergent samples
        comp.divergent_samples = comp.divergent_samples[-100:]

    # Check completion
    if deployment.config.max_samples and comp.total_samples >= deployment.config.max_samples:
        deployment.status = ShadowStatus.COMPLETED
        deployment.completed_at = datetime.now(timezone.utc).isoformat()

    deployments[dep_idx] = deployment.model_dump()
    _save_deployments(deployments)

    # Only return production result
    return prod_result


def complete_shadow_deployment(deployment_id: str) -> ShadowDeployment:
    """Manually complete a shadow deployment."""
    deployments = _load_deployments()
    for i, d in enumerate(deployments):
        if d["id"] == deployment_id:
            dep = ShadowDeployment(**d)
            dep.status = ShadowStatus.COMPLETED
            dep.completed_at = datetime.now(timezone.utc).isoformat()
            deployments[i] = dep.model_dump()
            _save_deployments(deployments)
            return dep
    raise KeyError(f"Shadow deployment '{deployment_id}' not found.")
