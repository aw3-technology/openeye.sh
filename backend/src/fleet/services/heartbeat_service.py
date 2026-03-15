"""Heartbeat processing and offline detection service."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from supabase import Client

from ..models import CommandStatus, DeviceStatus, HeartbeatRequest

logger = logging.getLogger(__name__)

OFFLINE_THRESHOLD_SECONDS = 60  # Mark offline after missing ~4 heartbeats (15s interval)


class HeartbeatService:
    def __init__(self, sb: Client):
        self.sb = sb

    def process_heartbeat(self, device_id: str, req: HeartbeatRequest) -> List[Dict[str, Any]]:
        """Record heartbeat, update device status, return pending commands."""
        # Verify device exists
        dev_check = self.sb.table("devices").select("id").eq("id", device_id).limit(1).execute()
        if not dev_check.data:
            raise KeyError(f"Device {device_id} not found")

        now = datetime.now(timezone.utc).isoformat()

        # Insert heartbeat record
        hb_row = {
            "device_id": device_id,
            "resource_usage": req.resource_usage.model_dump(),
            "firmware_version": req.firmware_version,
            "model_version": req.model_version,
            "agent_version": req.agent_version,
            "ip_address": req.ip_address,
        }
        self.sb.table("heartbeats").insert(hb_row).execute()

        # Update device status and last_heartbeat_at
        device_updates: Dict[str, Any] = {
            "status": DeviceStatus.ONLINE.value,
            "last_heartbeat_at": now,
        }
        if req.firmware_version:
            device_updates["firmware_version"] = req.firmware_version
        if req.model_version:
            device_updates["current_model_version"] = req.model_version
        if req.ip_address:
            device_updates["ip_address"] = req.ip_address

        self.sb.table("devices").update(device_updates).eq("id", device_id).execute()

        # Fetch pending commands for this device
        cmd_result = (
            self.sb.table("device_commands")
            .select("id, command_type, payload")
            .eq("device_id", device_id)
            .eq("status", CommandStatus.PENDING.value)
            .order("issued_at")
            .execute()
        )
        pending = cmd_result.data or []

        # Mark commands as acked
        for cmd in pending:
            self.sb.table("device_commands").update(
                {"status": CommandStatus.ACKED.value, "acked_at": now}
            ).eq("id", cmd["id"]).execute()

        return pending

    def detect_offline_devices(self, user_id: str) -> List[str]:
        """Find devices that missed heartbeats and mark them offline. Returns IDs."""
        threshold = (datetime.now(timezone.utc) - timedelta(seconds=OFFLINE_THRESHOLD_SECONDS)).isoformat()
        result = (
            self.sb.table("devices")
            .select("id, last_heartbeat_at")
            .eq("user_id", user_id)
            .eq("status", DeviceStatus.ONLINE.value)
            .lt("last_heartbeat_at", threshold)
            .execute()
        )
        offline_ids = [d["id"] for d in (result.data or [])]
        for did in offline_ids:
            self.sb.table("devices").update({"status": DeviceStatus.OFFLINE.value}).eq("id", did).execute()
            logger.warning("Device %s marked offline (missed heartbeats)", did)
        return offline_ids

    def get_resource_history(self, user_id: str, device_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Return recent heartbeats with resource_usage for a device.

        Verifies device ownership before returning data.
        """
        # Verify user owns the device (defense-in-depth; router also checks)
        dev_check = (
            self.sb.table("devices")
            .select("id")
            .eq("id", device_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not dev_check.data:
            raise KeyError(f"Device {device_id} not found")

        result = (
            self.sb.table("heartbeats")
            .select("resource_usage, created_at")
            .eq("device_id", device_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(reversed(result.data or []))
