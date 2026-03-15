"""Heartbeat endpoint – called by device agents."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..deps import get_device_api_key, get_supabase
from ..models import HeartbeatRequest, HeartbeatResponse, PendingCommand
from ..services.heartbeat_service import HeartbeatService

router = APIRouter()


@router.post("", response_model=HeartbeatResponse)
async def receive_heartbeat(
    req: HeartbeatRequest,
    device_id: str = Depends(get_device_api_key),
    sb=Depends(get_supabase),
):
    svc = HeartbeatService(sb)
    pending = svc.process_heartbeat(device_id, req)
    return HeartbeatResponse(
        status="ok",
        server_time=datetime.now(timezone.utc),
        pending_commands=[
            PendingCommand(id=c["id"], command_type=c["command_type"], payload=c.get("payload", {}))
            for c in pending
        ],
    )
