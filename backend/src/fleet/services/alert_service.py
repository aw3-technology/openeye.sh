"""Fleet alert management service."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client

logger = logging.getLogger(__name__)


class AlertService:
    def __init__(self, sb: Client):
        self.sb = sb

    def create_alert(
        self,
        user_id: str,
        alert_type: str,
        severity: str,
        title: str,
        message: str = "",
        device_id: Optional[str] = None,
        deployment_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = {
            "user_id": user_id,
            "alert_type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
            "device_id": device_id,
            "deployment_id": deployment_id,
        }
        result = self.sb.table("fleet_alerts").insert(row).execute()
        if not result.data:
            raise RuntimeError("Failed to insert alert")
        return result.data[0]

    def list_alerts(
        self,
        user_id: str,
        resolved: Optional[bool] = None,
        severity: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        q = self.sb.table("fleet_alerts").select("*").eq("user_id", user_id)
        if resolved is not None:
            q = q.eq("resolved", resolved)
        if severity:
            q = q.eq("severity", severity)
        q = q.order("created_at", desc=True)
        return q.execute().data or []

    def resolve_alert(self, user_id: str, alert_id: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        result = (
            self.sb.table("fleet_alerts")
            .update({"resolved": True, "resolved_at": now})
            .eq("id", alert_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Alert {alert_id} not found")
        return result.data[0]
