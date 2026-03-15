"""Maintenance window management service."""

import logging
from typing import Any, Dict, List, Optional

from supabase import Client

from ..models import MaintenanceWindowCreateRequest

logger = logging.getLogger(__name__)


class MaintenanceService:
    def __init__(self, sb: Client):
        self.sb = sb

    def create(self, user_id: str, req: MaintenanceWindowCreateRequest) -> Dict[str, Any]:
        if req.ends_at <= req.starts_at:
            raise ValueError("ends_at must be after starts_at")
        row = {
            "user_id": user_id,
            "name": req.name,
            "description": req.description,
            "device_ids": req.device_ids,
            "group_id": req.group_id,
            "starts_at": req.starts_at.isoformat(),
            "ends_at": req.ends_at.isoformat(),
            "recurrence": req.recurrence,
        }
        result = self.sb.table("maintenance_windows").insert(row).execute()
        if not result.data:
            raise RuntimeError("Failed to insert maintenance window")
        return result.data[0]

    def list_windows(self, user_id: str, active_only: bool = False) -> List[Dict[str, Any]]:
        q = self.sb.table("maintenance_windows").select("*").eq("user_id", user_id)
        if active_only:
            q = q.eq("is_active", True)
        q = q.order("starts_at", desc=True)
        return q.execute().data or []

    def get_window(self, user_id: str, window_id: str) -> Dict[str, Any]:
        result = (
            self.sb.table("maintenance_windows")
            .select("*")
            .eq("id", window_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Maintenance window {window_id} not found")
        return result.data[0]

    def update_window(self, user_id: str, window_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        result = (
            self.sb.table("maintenance_windows")
            .update(updates)
            .eq("id", window_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Maintenance window {window_id} not found")
        return result.data[0]

    def delete_window(self, user_id: str, window_id: str) -> None:
        self.sb.table("maintenance_windows").delete().eq("id", window_id).eq("user_id", user_id).execute()
