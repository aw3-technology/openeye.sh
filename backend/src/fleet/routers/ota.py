"""OTA firmware update endpoint."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user_id, get_supabase
from ..models import OTAUpdateRequest
from ..services.ota_service import OTAService

router = APIRouter()


@router.post("/update", status_code=202)
async def push_ota_update(
    req: OTAUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = OTAService(sb)
    try:
        commands = svc.push_update(user_id, req)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    return {"status": "queued", "command_count": len(commands)}
