"""Fleet alert list + resolve."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user_id, get_supabase
from ..models import FleetAlertResponse
from ..services.alert_service import AlertService

router = APIRouter()


@router.get("", response_model=List[FleetAlertResponse])
async def list_alerts(
    resolved: Optional[bool] = None,
    severity: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = AlertService(sb)
    return svc.list_alerts(user_id, resolved, severity)


@router.post("/{alert_id}/resolve", response_model=FleetAlertResponse)
async def resolve_alert(
    alert_id: str,
    user_id: str = Depends(get_current_user_id),
    sb=Depends(get_supabase),
):
    svc = AlertService(sb)
    try:
        return svc.resolve_alert(user_id, alert_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Alert not found")
