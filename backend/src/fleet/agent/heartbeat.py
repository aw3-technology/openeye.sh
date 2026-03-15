"""Periodic heartbeat sender."""

import asyncio
import logging
from typing import Any, Callable, Dict, List, Optional

import httpx

from ..models import HeartbeatRequest, ResourceUsage
from .config import AgentConfig
from .resource_monitor import ResourceMonitor

logger = logging.getLogger(__name__)


class HeartbeatSender:
    def __init__(self, config: AgentConfig, on_commands: Optional[Callable] = None):
        self.config = config
        self.monitor = ResourceMonitor()
        self.on_commands = on_commands
        self._running = False

    async def start(self) -> None:
        """Start the heartbeat loop."""
        self._running = True
        logger.info("Heartbeat sender started (interval=%.1fs)", self.config.heartbeat_interval)
        while self._running:
            try:
                await self._send_heartbeat()
            except Exception as exc:
                logger.error("Heartbeat failed: %s", exc)
            await asyncio.sleep(self.config.heartbeat_interval)

    def stop(self) -> None:
        self._running = False

    async def _send_heartbeat(self) -> None:
        usage = self.monitor.collect()
        payload = HeartbeatRequest(
            device_id=self.config.device_id,
            resource_usage=usage,
        ).model_dump()

        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.post(
                f"{self.config.server_url}/heartbeats",
                json=payload,
                headers={"X-Device-API-Key": self.config.api_key},
            )
            resp.raise_for_status()
            data = resp.json()

        pending = data.get("pending_commands", [])
        if pending and self.on_commands:
            await self.on_commands(pending)
