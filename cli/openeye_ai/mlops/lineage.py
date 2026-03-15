"""Model lineage tracking (story 189).

Traces which dataset, hyperparameters, and code commit produced each model version.
"""

from __future__ import annotations

import subprocess
from typing import Any

from openeye_ai.config import OPENEYE_HOME

from .persistence import atomic_save_yaml, safe_load_yaml_list
from .schemas import ModelLineage

_LINEAGE_PATH = OPENEYE_HOME / "model_lineage.yaml"

def _load_lineage() -> list[dict]:
    return safe_load_yaml_list(_LINEAGE_PATH)

def _save_lineage(records: list[dict]) -> None:
    atomic_save_yaml(_LINEAGE_PATH, records)

def _get_current_git_info() -> dict[str, str]:
    """Get current git commit, repo, and branch."""
    info = {}
    try:
        info["commit"] = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        info["commit"] = ""

    try:
        info["branch"] = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        info["branch"] = ""

    try:
        info["repo"] = subprocess.check_output(
            ["git", "remote", "get-url", "origin"], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        info["repo"] = ""

    return info

def record_lineage(
    model_key: str,
    version: str,
    *,
    dataset: str,
    dataset_version: str = "",
    dataset_size: int | None = None,
    hyperparameters: dict[str, Any] | None = None,
    code_commit: str = "",
    code_repo: str = "",
    code_branch: str = "",
    training_framework: str = "",
    training_duration_seconds: float | None = None,
    parent_model: str | None = None,
    environment: dict[str, str] | None = None,
    auto_detect_git: bool = True,
) -> ModelLineage:
    """Record the lineage for a model version.

    If auto_detect_git is True and code_commit is empty, automatically
    captures the current git state.
    """
    if auto_detect_git and not code_commit:
        git_info = _get_current_git_info()
        code_commit = code_commit or git_info.get("commit", "")
        code_repo = code_repo or git_info.get("repo", "")
        code_branch = code_branch or git_info.get("branch", "")

    # Auto-detect environment
    env = dict(environment or {})
    if not env:
        import platform
        import sys

        env["python_version"] = sys.version.split()[0]
        env["platform"] = platform.platform()

        try:
            import torch

            env["torch_version"] = torch.__version__
            if torch.cuda.is_available():
                env["cuda_version"] = torch.version.cuda or ""
                env["gpu"] = torch.cuda.get_device_name(0)
        except ImportError:
            pass

    lineage = ModelLineage(
        model_key=model_key,
        version=version,
        dataset=dataset,
        dataset_version=dataset_version,
        dataset_size=dataset_size,
        hyperparameters=hyperparameters or {},
        code_commit=code_commit,
        code_repo=code_repo,
        code_branch=code_branch,
        training_framework=training_framework,
        training_duration_seconds=training_duration_seconds,
        parent_model=parent_model,
        environment=env,
    )

    records = _load_lineage()

    # Replace existing lineage for same model+version
    records = [
        r
        for r in records
        if not (r.get("model_key") == model_key and r.get("version") == version)
    ]
    records.append(lineage.model_dump())
    _save_lineage(records)

    return lineage

def get_lineage(model_key: str, version: str) -> ModelLineage:
    """Get lineage for a specific model version."""
    records = _load_lineage()
    for r in records:
        if r.get("model_key") == model_key and r.get("version") == version:
            return ModelLineage(**r)
    raise KeyError(f"No lineage found for {model_key} v{version}")

def list_lineage(model_key: str | None = None) -> list[ModelLineage]:
    """List all lineage records."""
    records = _load_lineage()
    result = [ModelLineage(**r) for r in records]
    if model_key:
        result = [r for r in result if r.model_key == model_key]
    return result

def get_lineage_chain(model_key: str, version: str) -> list[ModelLineage]:
    """Get the full lineage chain for a model version (follows parent_model links)."""
    chain = []
    current_version = version

    visited = set()
    while current_version:
        if current_version in visited:
            break
        visited.add(current_version)

        try:
            lineage = get_lineage(model_key, current_version)
            chain.append(lineage)
            current_version = lineage.parent_model
        except KeyError:
            break

    return chain
