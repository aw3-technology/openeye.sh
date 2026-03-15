"""Device command queue management service."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client

from ..models import CommandStatus

logger = logging.getLogger(__name__)


class CommandService:
    def __init__(self, sb: Client):
        self.sb = sb

    def enqueue(
        self,
        user_id: str,
        device_id: str,
        command_type: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        row = {
            "device_id": device_id,
            "user_id": user_id,
            "command_type": command_type,
            "payload": payload or {},
            "status": CommandStatus.PENDING.value,
        }
        result = self.sb.table("device_commands").insert(row).execute()
        if not result.data:
            raise RuntimeError("Failed to insert command")
        return result.data[0]

    def list_commands(
        self,
        user_id: str,
        device_id: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        q = self.sb.table("device_commands").select("*").eq("user_id", user_id)
        if device_id:
            q = q.eq("device_id", device_id)
        if status_filter:
            q = q.eq("status", status_filter)
        q = q.order("issued_at", desc=True)
        return q.execute().data or []

    def complete_command(self, user_id: str, command_id: str, result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        # Verify command belongs to user
        check = (
            self.sb.table("device_commands")
            .select("id")
            .eq("id", command_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not check.data:
            raise KeyError(f"Command {command_id} not found")
        now = datetime.now(timezone.utc).isoformat()
        res = (
            self.sb.table("device_commands")
            .update({
                "status": CommandStatus.COMPLETED.value,
                "completed_at": now,
                "result": result or {},
            })
            .eq("id", command_id)
            .execute()
        )
        if not res.data:
            raise KeyError(f"Command {command_id} not found")
        return res.data[0]

    def device_complete_command(self, device_id: str, command_id: str, result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Complete a command using device identity (for device agent auth)."""
        check = (
            self.sb.table("device_commands")
            .select("id")
            .eq("id", command_id)
            .eq("device_id", device_id)
            .limit(1)
            .execute()
        )
        if not check.data:
            raise KeyError(f"Command {command_id} not found for device {device_id}")
        now = datetime.now(timezone.utc).isoformat()
        res = (
            self.sb.table("device_commands")
            .update({
                "status": CommandStatus.COMPLETED.value,
                "completed_at": now,
                "result": result or {},
            })
            .eq("id", command_id)
            .execute()
        )
        if not res.data:
            raise KeyError(f"Command {command_id} not found")
        return res.data[0]

    def fail_command(self, command_id: str, error: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        res = (
            self.sb.table("device_commands")
            .update({
                "status": CommandStatus.FAILED.value,
                "completed_at": now,
                "result": {"error": error},
            })
            .eq("id", command_id)
            .execute()
        )
        if not res.data:
            raise KeyError(f"Command {command_id} not found")
        return res.data[0]
