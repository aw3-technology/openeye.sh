"""Fleet alert Pydantic models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .enums import AlertSeverity, AlertType


class FleetAlertResponse(BaseModel):
    id: str
    user_id: str
    device_id: Optional[str] = None
    deployment_id: Optional[str] = None
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    created_at: datetime
