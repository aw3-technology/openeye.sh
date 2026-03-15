"""FastAPI router for governance endpoints."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from governance.engine import GovernanceEngine
from governance.loader import list_presets, validate_yaml
from governance.models import (
    AuditEntry,
    GovernanceConfig,
    GovernanceStatus,
    PolicyInfo,
)

router = APIRouter(prefix="/governance", tags=["governance"])

# The engine is injected at server startup via set_engine()
_engine: GovernanceEngine | None = None


def set_engine(engine: GovernanceEngine) -> None:
    global _engine
    _engine = engine


def _get_engine() -> GovernanceEngine:
    if _engine is None:
        raise HTTPException(status_code=503, detail="Governance engine not initialized")
    return _engine


# ── Status ────────────────────────────────────────────────────────────


@router.get("/status", response_model=GovernanceStatus)
async def get_status():
    return _get_engine().get_status()


# ── Policies ──────────────────────────────────────────────────────────


@router.get("/policies", response_model=list[PolicyInfo])
async def list_policies():
    return _get_engine().list_policies()


@router.get("/policies/available", response_model=list[PolicyInfo])
async def list_available_policies():
    return _get_engine().list_available_types()


@router.post("/policies/{name}/enable")
async def enable_policy(name: str):
    if not _get_engine().enable_policy(name):
        raise HTTPException(status_code=404, detail=f"Policy not found: {name}")
    return {"status": "enabled", "name": name}


@router.post("/policies/{name}/disable")
async def disable_policy(name: str):
    if not _get_engine().disable_policy(name):
        raise HTTPException(status_code=404, detail=f"Policy not found: {name}")
    return {"status": "disabled", "name": name}


# ── Presets ───────────────────────────────────────────────────────────


@router.get("/presets", response_model=list[str])
async def get_presets():
    return list_presets()


@router.post("/presets/{name}/load")
async def load_preset(name: str):
    if not re.match(r"^[a-zA-Z0-9_-]+$", name):
        raise HTTPException(status_code=422, detail="Invalid preset name")
    try:
        _get_engine().load_preset(name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Preset not found: {name}")
    return {"status": "loaded", "preset": name}


# ── Config ────────────────────────────────────────────────────────────


class YAMLPayload(BaseModel):
    yaml: str


@router.get("/config")
async def get_config():
    return {"yaml": _get_engine().config_yaml}


@router.put("/config")
async def update_config(payload: YAMLPayload):
    try:
        _get_engine().update_config_yaml(payload.yaml)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "updated"}


# ── Audit ─────────────────────────────────────────────────────────────


@router.get("/audit", response_model=list[AuditEntry])
async def get_audit(limit: int = 100, offset: int = 0):
    return _get_engine().audit.get_entries(limit=limit, offset=offset)


@router.get("/violations", response_model=list[AuditEntry])
async def get_violations(limit: int = 50):
    return _get_engine().audit.get_violations(limit=limit)
