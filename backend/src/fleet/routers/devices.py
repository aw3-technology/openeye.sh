"""Device CRUD + tags + config overrides + restart + decommission."""

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_current_user_id, get_supabase
from ..models import (
    BatchDeviceRequest,
    CommandType,
    DecommissionRequest,
    DeviceRegisterRequest,
    DeviceResponse,
    DeviceUpdateRequest,
)
from ..services.command_service import CommandService
from ..services.device_service import DeviceService

router = APIRouter()


@router.post("", response_model=DeviceResponse, status_code=201)
async def register_device(
    req: DeviceRegisterRequest,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeviceService(sb)
    return svc.register(user_id, req)


@router.get("", response_model=List[DeviceResponse])
async def list_devices(
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    tag_key: Optional[str] = None,
    tag_value: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeviceService(sb)
    return svc.list_devices(user_id, status, device_type, tag_key, tag_value, limit=limit, offset=offset)


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeviceService(sb)
    try:
        return svc.get_device(user_id, device_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Device not found")


@router.patch("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: str,
    req: DeviceUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeviceService(sb)
    try:
        return svc.update_device(user_id, device_id, req)
    except KeyError:
        raise HTTPException(status_code=404, detail="Device not found")


@router.put("/{device_id}/tags", response_model=DeviceResponse)
async def set_tags(
    device_id: str,
    tags: Dict[str, str],
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeviceService(sb)
    try:
        return svc.set_tags(user_id, device_id, tags)
    except KeyError:
        raise HTTPException(status_code=404, detail="Device not found")


@router.put("/{device_id}/config", response_model=DeviceResponse)
async def set_config_overrides(
    device_id: str,
    config: Dict,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeviceService(sb)
    try:
        return svc.set_config_overrides(user_id, device_id, config)
    except KeyError:
        raise HTTPException(status_code=404, detail="Device not found")


@router.get("/{device_id}/resources")
async def get_resource_history(
    device_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    from ..services.heartbeat_service import HeartbeatService

    svc = HeartbeatService(sb)
    return svc.get_resource_history(user_id, device_id, limit)


@router.post("/{device_id}/restart", status_code=202)
async def restart_device(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    # Verify ownership
    DeviceService(sb).get_device(user_id, device_id)
    svc = CommandService(sb)
    cmd = svc.enqueue(user_id, device_id, CommandType.RESTART.value)
    return {"status": "queued", "command_id": cmd["id"]}


@router.delete("/{device_id}", response_model=DeviceResponse)
async def decommission_device(
    device_id: str,
    req: DecommissionRequest = DecommissionRequest(),
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeviceService(sb)
    try:
        device = svc.decommission(user_id, device_id, req.reason)
        if req.wipe_data:
            CommandService(sb).enqueue(
                user_id, device_id, CommandType.DECOMMISSION.value,
                {"wipe_data": True},
            )
        return device
    except KeyError:
        raise HTTPException(status_code=404, detail="Device not found")


@router.post("/batch")
async def batch_operation(
    req: BatchDeviceRequest,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    valid_actions = {ct.value for ct in CommandType}
    if req.action not in valid_actions:
        raise HTTPException(status_code=422, detail=f"Invalid action. Must be one of: {', '.join(sorted(valid_actions))}")
    svc = DeviceService(sb)
    cmd_svc = CommandService(sb)
    devices = svc.get_devices_by_tags(user_id, req.tag_filter)
    if not devices:
        raise HTTPException(status_code=404, detail="No devices matched the tag filter")
    results = []
    for d in devices:
        cmd = cmd_svc.enqueue(user_id, d["id"], req.action, req.payload)
        results.append({"device_id": d["id"], "command_id": cmd["id"]})
    return {"matched": len(devices), "commands": results}
