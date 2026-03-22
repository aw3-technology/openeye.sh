"""Routes for Story 189: Model Lineage."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/lineage/{model_key}/{version}")
async def get_lineage_endpoint(model_key: str, version: str):
    from ..lineage import get_lineage
    try:
        return get_lineage(model_key, version).model_dump()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/lineage/{model_key}/{version}/chain")
async def get_lineage_chain_endpoint(model_key: str, version: str):
    from ..lineage import get_lineage_chain
    return [l.model_dump() for l in get_lineage_chain(model_key, version)]

@router.get("/lineage")
async def list_lineage_endpoint(model_key: Optional[str] = None):
    from ..lineage import list_lineage
    return [l.model_dump() for l in list_lineage(model_key)]
