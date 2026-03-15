"""Device lifecycle management service."""

import hashlib
import logging
import secrets
from typing import Any, Dict, List, Optional

from supabase import Client

from ..models import DeviceRegisterRequest, DeviceStatus, DeviceUpdateRequest

logger = logging.getLogger(__name__)


class DeviceService:
    def __init__(self, sb: Client):
        self.sb = sb

    def register(self, user_id: str, req: DeviceRegisterRequest) -> Dict[str, Any]:
        """Register a new device, returning the row + plaintext API key."""
        api_key = f"oek_{secrets.token_urlsafe(32)}"
        api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()

        row = {
            "user_id": user_id,
            "name": req.name,
            "device_type": req.device_type.value,
            "status": DeviceStatus.PENDING.value,
            "api_key_hash": api_key_hash,
            "hardware_specs": req.hardware_specs.model_dump() if req.hardware_specs else {},
            "tags": req.tags,
            "firmware_version": req.firmware_version,
            "ip_address": req.ip_address,
        }
        result = self.sb.table("devices").insert(row).execute()
        if not result.data:
            raise RuntimeError("Failed to insert device")
        device = result.data[0]
        device["api_key"] = api_key
        return device

    def list_devices(
        self,
        user_id: str,
        status_filter: Optional[str] = None,
        device_type: Optional[str] = None,
        tag_key: Optional[str] = None,
        tag_value: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        q = self.sb.table("devices").select("*").eq("user_id", user_id)
        if status_filter:
            q = q.eq("status", status_filter)
        if device_type:
            q = q.eq("device_type", device_type)
        q = q.order("created_at", desc=True).range(offset, offset + limit - 1)
        result = q.execute()
        rows = result.data or []
        if tag_key:
            rows = [r for r in rows if r.get("tags", {}).get(tag_key) == tag_value]
        return rows

    def get_device(self, user_id: str, device_id: str) -> Dict[str, Any]:
        result = (
            self.sb.table("devices")
            .select("*")
            .eq("id", device_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Device {device_id} not found")
        return result.data[0]

    def update_device(self, user_id: str, device_id: str, req: DeviceUpdateRequest) -> Dict[str, Any]:
        updates = req.model_dump(exclude_none=True)
        if "device_type" in updates:
            updates["device_type"] = updates["device_type"].value if hasattr(updates["device_type"], "value") else updates["device_type"]
        result = (
            self.sb.table("devices")
            .update(updates)
            .eq("id", device_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Device {device_id} not found")
        return result.data[0]

    def set_tags(self, user_id: str, device_id: str, tags: Dict[str, str]) -> Dict[str, Any]:
        result = (
            self.sb.table("devices")
            .update({"tags": tags})
            .eq("id", device_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Device {device_id} not found")
        return result.data[0]

    def set_config_overrides(self, user_id: str, device_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        result = (
            self.sb.table("devices")
            .update({"config_overrides": config})
            .eq("id", device_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Device {device_id} not found")
        return result.data[0]

    def decommission(self, user_id: str, device_id: str, reason: str = "") -> Dict[str, Any]:
        result = (
            self.sb.table("devices")
            .update({"status": DeviceStatus.DECOMMISSIONED.value})
            .eq("id", device_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Device {device_id} not found")
        logger.info("Device %s decommissioned: %s", device_id, reason)
        return result.data[0]

    def get_devices_by_tags(self, user_id: str, tag_filter: Dict[str, str]) -> List[Dict[str, Any]]:
        """Return all user devices matching every key-value pair in tag_filter."""
        all_devices = self.list_devices(user_id)
        matched = []
        for d in all_devices:
            tags = d.get("tags", {}) or {}
            if all(tags.get(k) == v for k, v in tag_filter.items()):
                matched.append(d)
        return matched
