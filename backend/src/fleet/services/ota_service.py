"""OTA firmware update service."""

import logging
from typing import Any, Dict, List

from supabase import Client

from ..models import CommandType, OTAUpdateRequest

logger = logging.getLogger(__name__)


class OTAService:
    def __init__(self, sb: Client):
        self.sb = sb

    def push_update(self, user_id: str, req: OTAUpdateRequest) -> List[Dict[str, Any]]:
        """Enqueue OTA update commands for each target device."""
        # Verify user owns all target devices
        owned = (
            self.sb.table("devices")
            .select("id")
            .eq("user_id", user_id)
            .in_("id", req.device_ids)
            .execute()
        )
        owned_ids = {row["id"] for row in (owned.data or [])}
        unauthorized = [did for did in req.device_ids if did not in owned_ids]
        if unauthorized:
            raise PermissionError(f"User does not own devices: {unauthorized}")

        commands = []
        for device_id in req.device_ids:
            row = {
                "device_id": device_id,
                "user_id": user_id,
                "command_type": CommandType.OTA_UPDATE.value,
                "payload": {
                    "firmware_url": req.firmware_url,
                    "firmware_version": req.firmware_version,
                    "checksum": req.checksum,
                    "bandwidth_limit_mbps": req.bandwidth_limit_mbps,
                    "force": req.force,
                },
                "status": "pending",
            }
            result = self.sb.table("device_commands").insert(row).execute()
            commands.append(result.data[0])
        logger.info("OTA update queued for %d devices", len(req.device_ids))
        return commands
