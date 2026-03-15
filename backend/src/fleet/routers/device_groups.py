"""Device group CRUD + members + scaling policy."""

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_current_user_id, get_supabase
from ..models import AutoScalingPolicy, DeviceGroupCreateRequest, DeviceGroupResponse
from ..services.device_service import DeviceService

router = APIRouter()


@router.post("", response_model=DeviceGroupResponse, status_code=201)
async def create_group(
    req: DeviceGroupCreateRequest,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    if not req.name.strip():
        raise HTTPException(status_code=422, detail="Group name cannot be empty")
    row = {
        "user_id": user_id,
        "name": req.name.strip(),
        "description": req.description,
        "tag_filter": req.tag_filter,
    }
    result = sb.table("device_groups").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create group")
    group = result.data[0]
    group["device_count"] = 0
    return group


@router.get("", response_model=List[DeviceGroupResponse])
async def list_groups(
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    result = (
        sb.table("device_groups")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    groups = result.data or []
    for g in groups:
        count_result = (
            sb.table("device_group_members")
            .select("id", count="exact")
            .eq("group_id", g["id"])
            .execute()
        )
        g["device_count"] = count_result.count or 0
    return groups


@router.get("/{group_id}", response_model=DeviceGroupResponse)
async def get_group(
    group_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    result = (
        sb.table("device_groups")
        .select("*")
        .eq("id", group_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    group = result.data[0]
    count_result = (
        sb.table("device_group_members")
        .select("id", count="exact")
        .eq("group_id", group_id)
        .execute()
    )
    group["device_count"] = count_result.count or 0
    return group


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    # Verify ownership
    result = (
        sb.table("device_groups")
        .select("id")
        .eq("id", group_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    # Check for active deployments targeting this group
    active_deps = (
        sb.table("deployments")
        .select("id", count="exact")
        .eq("target_group_id", group_id)
        .in_("status", ["pending", "in_progress"])
        .execute()
    )
    if active_deps.count and active_deps.count > 0:
        raise HTTPException(status_code=409, detail="Cannot delete group with active deployments")
    sb.table("device_groups").delete().eq("id", group_id).eq("user_id", user_id).execute()


@router.post("/{group_id}/members", status_code=201)
async def add_member(
    group_id: str,
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    # Verify user owns the group
    group_result = (
        sb.table("device_groups")
        .select("id")
        .eq("id", group_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not group_result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    # Verify user owns the device
    device_result = (
        sb.table("devices")
        .select("id")
        .eq("id", device_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not device_result.data:
        raise HTTPException(status_code=404, detail="Device not found")
    row = {"group_id": group_id, "device_id": device_id}
    try:
        result = sb.table("device_group_members").insert(row).execute()
    except Exception:
        raise HTTPException(status_code=409, detail="Device already in group")
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add member")
    return result.data[0]


@router.delete("/{group_id}/members/{device_id}", status_code=204)
async def remove_member(
    group_id: str,
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    # Verify user owns the group
    group_result = (
        sb.table("device_groups")
        .select("id")
        .eq("id", group_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not group_result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    sb.table("device_group_members").delete().eq("group_id", group_id).eq("device_id", device_id).execute()


@router.get("/{group_id}/members")
async def list_members(
    group_id: str,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    # Verify user owns the group
    group_result = (
        sb.table("device_groups")
        .select("id")
        .eq("id", group_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not group_result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    result = (
        sb.table("device_group_members")
        .select("device_id")
        .eq("group_id", group_id)
        .range(offset, offset + limit - 1)
        .execute()
    )
    device_ids = [r["device_id"] for r in (result.data or [])]
    if not device_ids:
        return []
    devices = sb.table("devices").select("*").eq("user_id", user_id).in_("id", device_ids).execute()
    return devices.data or []


@router.put("/{group_id}/scaling", response_model=DeviceGroupResponse)
async def set_scaling_policy(
    group_id: str,
    policy: AutoScalingPolicy,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    result = (
        sb.table("device_groups")
        .update({"auto_scaling_policy": policy.model_dump()})
        .eq("id", group_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    group = result.data[0]
    count_result = (
        sb.table("device_group_members")
        .select("id", count="exact")
        .eq("group_id", group_id)
        .execute()
    )
    group["device_count"] = count_result.count or 0
    return group
