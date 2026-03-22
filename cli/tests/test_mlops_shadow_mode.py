"""Tests for openeye_ai.mlops.shadow_mode."""

from __future__ import annotations

import pytest


class TestShadowMode:
    def test_create_and_list(self):
        from openeye_ai.mlops.shadow_mode import create_shadow_deployment, list_shadow_deployments
        from openeye_ai.mlops.schemas import ShadowDeploymentConfig

        config = ShadowDeploymentConfig(
            name="s1", model_key="m",
            production_version="v1", shadow_version="v2",
        )
        dep = create_shadow_deployment(config)
        assert dep.id.startswith("shadow-")
        assert dep.status.value == "active"

        deps = list_shadow_deployments()
        assert len(deps) == 1
        assert list_shadow_deployments(model_key="m") == deps
        assert list_shadow_deployments(model_key="other") == []

    def test_complete_shadow_deployment(self):
        from openeye_ai.mlops.shadow_mode import (
            complete_shadow_deployment,
            create_shadow_deployment,
        )
        from openeye_ai.mlops.schemas import ShadowDeploymentConfig, ShadowStatus

        config = ShadowDeploymentConfig(
            name="s2", model_key="m",
            production_version="v1", shadow_version="v2",
        )
        dep = create_shadow_deployment(config)
        completed = complete_shadow_deployment(dep.id)
        assert completed.status == ShadowStatus.COMPLETED
        assert completed.completed_at is not None

    def test_complete_nonexistent(self):
        from openeye_ai.mlops.shadow_mode import complete_shadow_deployment

        with pytest.raises(KeyError):
            complete_shadow_deployment("shadow-nope")

    def test_get_shadow_deployment_not_found(self):
        from openeye_ai.mlops.shadow_mode import get_shadow_deployment

        with pytest.raises(KeyError, match="not found"):
            get_shadow_deployment("shadow-nonexistent")

    def test_get_shadow_deployment_success(self):
        from openeye_ai.mlops.shadow_mode import create_shadow_deployment, get_shadow_deployment
        from openeye_ai.mlops.schemas import ShadowDeploymentConfig

        config = ShadowDeploymentConfig(
            name="get-test", model_key="m",
            production_version="v1", shadow_version="v2",
        )
        dep = create_shadow_deployment(config)
        fetched = get_shadow_deployment(dep.id)
        assert fetched.id == dep.id
        assert fetched.config.name == "get-test"
