"""Routes for Story 190: Model Export."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from ..schemas import ExportRequest

router = APIRouter()


@router.post("/export")
async def export_model_endpoint(request: ExportRequest):
    from ..export import export_model
    try:
        return export_model(request).model_dump()
    except (FileNotFoundError, ValueError, NotImplementedError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/exports")
async def list_exports_endpoint(model_key: Optional[str] = None):
    from ..export import list_exports
    return [e.model_dump() for e in list_exports(model_key)]
