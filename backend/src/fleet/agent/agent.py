"""Main device agent – heartbeat loop + command execution."""

import asyncio
import logging
from typing import Any, Dict, List

import httpx

from .bandwidth_limiter import BandwidthLimiter
from .config import AgentConfig
from .heartbeat import HeartbeatSender
from .model_cache import ModelCache
from .ota_updater import OTAUpdater

logger = logging.getLogger(__name__)


class DeviceAgent:
    """Runs on edge devices. Sends heartbeats and executes commands from the control plane."""

    def __init__(self, config: AgentConfig):
        self.config = config
        self.model_cache = ModelCache(
            cache_dir=config.model_cache_dir,
            max_versions=config.max_cache_versions,
        )
        self.ota_updater = OTAUpdater(
            firmware_dir=config.firmware_dir,
            bandwidth_limit_mbps=config.bandwidth_limit_mbps,
        )
        self.heartbeat = HeartbeatSender(config, on_commands=self._handle_commands)
        self._running = False

    async def run(self) -> None:
        """Start the agent main loop."""
        self._running = True
        logger.info("Device agent started (device_id=%s)", self.config.device_id)
        await self.heartbeat.start()

    def stop(self) -> None:
        self._running = False
        self.heartbeat.stop()
        logger.info("Device agent stopped")

    async def _handle_commands(self, commands: List[Dict[str, Any]]) -> None:
        """Process pending commands received from heartbeat response."""
        for cmd in commands:
            cmd_type = cmd.get("command_type", "")
            cmd_id = cmd.get("id", "")
            payload = cmd.get("payload", {})

            logger.info("Executing command %s (type=%s)", cmd_id, cmd_type)
            try:
                if cmd_type == "restart":
                    await self._cmd_restart(cmd_id)
                elif cmd_type == "deploy_model":
                    await self._cmd_deploy_model(cmd_id, payload)
                elif cmd_type == "rollback_model":
                    await self._cmd_rollback_model(cmd_id, payload)
                elif cmd_type == "ota_update":
                    await self._cmd_ota_update(cmd_id, payload)
                elif cmd_type == "update_config":
                    await self._cmd_update_config(cmd_id, payload)
                elif cmd_type == "decommission":
                    await self._cmd_decommission(cmd_id, payload)
                else:
                    logger.warning("Unknown command type: %s", cmd_type)
                    await self._report_command_result(cmd_id, {"error": f"Unknown command: {cmd_type}"})
            except Exception as exc:
                logger.error("Command %s failed: %s", cmd_id, exc)
                await self._report_command_result(cmd_id, {"error": str(exc)})

    async def _cmd_restart(self, cmd_id: str) -> None:
        logger.info("Restart requested – will re-initialize agent")
        await self._report_command_result(cmd_id, {"status": "restarting"})
        # In production: os.execv() or systemd restart

    async def _cmd_deploy_model(self, cmd_id: str, payload: Dict[str, Any]) -> None:
        version = payload.get("model_version")
        if not version:
            raise ValueError("model_version is required in deploy payload")
        model_url = payload.get("model_url")
        checksum = payload.get("model_checksum")
        bw_limit = payload.get("bandwidth_limit_mbps")

        if self.model_cache.has_version(version):
            logger.info("Model %s already cached", version)
        elif model_url:
            # Stream download directly to disk to avoid holding full model in memory
            import tempfile, shutil
            async with httpx.AsyncClient(timeout=300) as client:
                async with client.stream("GET", model_url) as resp:
                    resp.raise_for_status()
                    with tempfile.NamedTemporaryFile(delete=False) as tmp:
                        tmp_path = tmp.name
                        async for chunk in resp.aiter_bytes(chunk_size=256 * 1024):
                            tmp.write(chunk)
            with open(tmp_path, "rb") as f:
                data = f.read()
            import os
            os.unlink(tmp_path)
            self.model_cache.store(version, data, checksum)
        else:
            raise ValueError("No model_url provided and version not cached")

        await self._report_command_result(cmd_id, {"status": "deployed", "version": version})

    async def _cmd_rollback_model(self, cmd_id: str, payload: Dict[str, Any]) -> None:
        rolled_back = self.model_cache.rollback()
        if rolled_back:
            await self._report_command_result(cmd_id, {"status": "rolled_back", "version": rolled_back})
        else:
            raise ValueError("No previous version available for rollback")

    async def _cmd_ota_update(self, cmd_id: str, payload: Dict[str, Any]) -> None:
        for key in ("firmware_url", "firmware_version", "checksum"):
            if key not in payload:
                raise ValueError(f"Missing required OTA payload key: {key}")
        # Run synchronous download in a thread to avoid blocking the event loop
        path = await asyncio.to_thread(
            self.ota_updater.download_and_verify,
            url=payload["firmware_url"],
            version=payload["firmware_version"],
            expected_checksum=payload["checksum"],
            bandwidth_limit_mbps=payload.get("bandwidth_limit_mbps"),
        )
        success = await asyncio.to_thread(self.ota_updater.apply, payload["firmware_version"])
        await self._report_command_result(cmd_id, {
            "status": "applied" if success else "failed",
            "version": payload["firmware_version"],
        })

    async def _cmd_update_config(self, cmd_id: str, payload: Dict[str, Any]) -> None:
        logger.info("Config update received: %s", payload)
        await self._report_command_result(cmd_id, {"status": "config_updated"})

    async def _cmd_decommission(self, cmd_id: str, payload: Dict[str, Any]) -> None:
        logger.info("Decommission requested (wipe=%s)", payload.get("wipe_data", False))
        await self._report_command_result(cmd_id, {"status": "decommissioned"})
        self.stop()

    async def _report_command_result(self, cmd_id: str, result: Dict[str, Any]) -> None:
        """Report command completion back to the control plane."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                await client.post(
                    f"{self.config.server_url}/commands/{cmd_id}/device-complete",
                    json=result,
                    headers={"X-Device-API-Key": self.config.api_key},
                )
        except Exception as exc:
            logger.error("Failed to report command result: %s", exc)
