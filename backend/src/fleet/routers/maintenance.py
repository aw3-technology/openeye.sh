"""Maintenance window CRUD."""

from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..deps import get_current_user_id, get_supabase
from ..models import MaintenanceWindowCreateRequest, MaintenanceWindowResponse
from ..services.maintenance_service import MaintenanceService


class MaintenanceWindowUpdateRequest(BaseModel):
    """Whitelisted fields for PATCH updates."""
    name: Optional[str] = None
    description: Optional[str] = None
    device_ids: Optional[List[str]] = None
    group_id: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    recurrence: Optional[str] = None
    is_active: Optional[bool] = None

router = APIRouter()


@router.post("", response_model=MaintenanceWindowResponse, status_code=201)
async def create_maintenance_window(
    req: MaintenanceWindowCreateRequest,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = MaintenanceService(sb)
    return svc.create(user_id, req)


@router.get("", response_model=List[MaintenanceWindowResponse])
async def list_maintenance_windows(
    active_only: bool = False,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = MaintenanceService(sb)
    return svc.list_windows(user_id, active_only)


@router.get("/{window_id}", response_model=MaintenanceWindowResponse)
async def get_maintenance_window(
    window_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = MaintenanceService(sb)
    try:
        return svc.get_window(user_id, window_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Maintenance window not found")


@router.patch("/{window_id}", response_model=MaintenanceWindowResponse)
async def update_maintenance_window(
    window_id: str,
    updates: MaintenanceWindowUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    # Only pass non-None fields to the service
    filtered = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not filtered:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    svc = MaintenanceService(sb)
    try:
        return svc.update_window(user_id, window_id, filtered)
    except KeyError:
        raise HTTPException(status_code=404, detail="Maintenance window not found")


@router.delete("/{window_id}", status_code=204)
async def delete_maintenance_window(
    window_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = MaintenanceService(sb)
    svc.delete_window(user_id, window_id)
