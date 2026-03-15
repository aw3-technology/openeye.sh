"""API routes for lineage, export, and shadow mode (stories 189-191)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import ExportRequest, ShadowDeploymentConfig

router = APIRouter()

# ── Story 189: Model Lineage ─────────────────────────────────────────

@router.get("/lineage/{model_key}/{version}")
async def get_lineage_endpoint(model_key: str, version: str):
    """Get lineage for a model version."""
    from ..lineage import get_lineage

    try:
        return get_lineage(model_key, version).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/lineage/{model_key}/{version}/chain")
async def get_lineage_chain_endpoint(model_key: str, version: str):
    """Get the full lineage chain for a model version."""
    from ..lineage import get_lineage_chain

    return [l.model_dump() for l in get_lineage_chain(model_key, version)]

@router.get("/lineage")
async def list_lineage_endpoint(model_key: str | None = None):
    """List all lineage records."""
    from ..lineage import list_lineage

    return [l.model_dump() for l in list_lineage(model_key)]

# ── Story 190: Model Export ───────────────────────────────────────────

@router.post("/export")
async def export_model_endpoint(request: ExportRequest):
    """Export a model to ONNX, TensorRT, or CoreML."""
    from ..export import export_model

    try:
        return export_model(request).model_dump()
    except (FileNotFoundError, ValueError, NotImplementedError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/exports")
async def list_exports_endpoint(model_key: str | None = None):
    """List model exports."""
    from ..export import list_exports

    return [e.model_dump() for e in list_exports(model_key)]

# ── Story 191: Shadow Mode ───────────────────────────────────────────

@router.post("/shadow-deployments")
async def create_shadow_endpoint(config: ShadowDeploymentConfig):
    """Create a shadow mode deployment."""
    from ..shadow_mode import create_shadow_deployment

    return create_shadow_deployment(config).model_dump()

@router.get("/shadow-deployments")
async def list_shadow_endpoint(model_key: str | None = None):
    """List shadow deployments."""
    from ..shadow_mode import list_shadow_deployments

    return [d.model_dump() for d in list_shadow_deployments(model_key)]

@router.get("/shadow-deployments/{deployment_id}")
async def get_shadow_endpoint(deployment_id: str):
    """Get a shadow deployment."""
    from ..shadow_mode import get_shadow_deployment

    try:
        return get_shadow_deployment(deployment_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/shadow-deployments/{deployment_id}/complete")
async def complete_shadow_endpoint(deployment_id: str):
    """Complete a shadow deployment."""
    from ..shadow_mode import complete_shadow_deployment

    try:
        return complete_shadow_deployment(deployment_id).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
