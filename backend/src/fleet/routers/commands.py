"""Device command queue management."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user_id, get_device_api_key, get_supabase
from ..services.command_service import CommandService

router = APIRouter()


@router.get("")
async def list_commands(
    device_id: Optional[str] = None,
    status: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = CommandService(sb)
    return svc.list_commands(user_id, device_id, status)


@router.post("/{command_id}/complete")
async def complete_command(
    command_id: str,
    result: Optional[dict] = None,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = CommandService(sb)
    try:
        return svc.complete_command(user_id, command_id, result)
    except KeyError:
        raise HTTPException(status_code=404, detail="Command not found")


@router.post("/{command_id}/device-complete")
async def device_complete_command(
    command_id: str,
    result: Optional[dict] = None,
    device_id: str = Depends(get_device_api_key),
    sb=Depends(get_supabase),
):
    """Complete a command using device API key auth (for device agents)."""
    svc = CommandService(sb)
    try:
        return svc.device_complete_command(device_id, command_id, result)
    except KeyError:
        raise HTTPException(status_code=404, detail="Command not found")
