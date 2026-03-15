"""Deployment management – create, advance, pause, rollback."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user_id, get_supabase
from ..models import DeploymentCreateRequest, DeploymentDeviceStatusResponse, DeploymentResponse
from ..services.deployment_service import DeploymentService

router = APIRouter()


@router.post("", response_model=DeploymentResponse, status_code=201)
async def create_deployment(
    req: DeploymentCreateRequest,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeploymentService(sb)
    return svc.create(user_id, req)


@router.get("", response_model=List[DeploymentResponse])
async def list_deployments(
    status: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeploymentService(sb)
    return svc.list_deployments(user_id, status)


@router.get("/{deployment_id}", response_model=DeploymentResponse)
async def get_deployment(
    deployment_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeploymentService(sb)
    try:
        return svc.get_deployment(user_id, deployment_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Deployment not found")


@router.get("/{deployment_id}/devices", response_model=List[DeploymentDeviceStatusResponse])
async def get_deployment_devices(
    deployment_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeploymentService(sb)
    return svc.get_device_statuses(user_id, deployment_id)


@router.post("/{deployment_id}/advance", response_model=DeploymentResponse)
async def advance_deployment(
    deployment_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeploymentService(sb)
    try:
        return svc.advance_stage(user_id, deployment_id)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{deployment_id}/pause", response_model=DeploymentResponse)
async def pause_deployment(
    deployment_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeploymentService(sb)
    try:
        return svc.pause(user_id, deployment_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Deployment not found")


@router.post("/{deployment_id}/rollback", response_model=DeploymentResponse)
async def rollback_deployment(
    deployment_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = DeploymentService(sb)
    try:
        return svc.rollback(user_id, deployment_id)
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
