"""Tests for DeviceAgent, HeartbeatSender, ResourceMonitor, ModelCache (Stories 66 + 67)."""

from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from fleet.agent.config import AgentConfig
from fleet.agent.model_cache import ModelCache


# ── AgentConfig ────────────────────────────────────────────────────


class TestAgentConfig:
    def test_defaults(self):
        cfg = AgentConfig()
        assert cfg.device_id == ""
        assert cfg.api_key == ""
        assert cfg.server_url == "http://localhost:8001"
        assert cfg.heartbeat_interval == 15.0
        assert cfg.model_cache_dir == "/tmp/openeye/models"
        assert cfg.firmware_dir == "/tmp/openeye/firmware"
        assert cfg.max_cache_versions == 2
        assert cfg.bandwidth_limit_mbps == 0
        assert cfg.log_level == "INFO"

    def test_custom_values(self):
        cfg = AgentConfig(
            device_id="dev-42",
            api_key="secret",
            server_url="https://fleet.example.com",
            heartbeat_interval=30.0,
            model_cache_dir="/data/models",
            firmware_dir="/data/firmware",
            max_cache_versions=5,
            bandwidth_limit_mbps=10.0,
            log_level="DEBUG",
        )
        assert cfg.device_id == "dev-42"
        assert cfg.api_key == "secret"
        assert cfg.server_url == "https://fleet.example.com"
        assert cfg.heartbeat_interval == 30.0
        assert cfg.model_cache_dir == "/data/models"
        assert cfg.max_cache_versions == 5
        assert cfg.bandwidth_limit_mbps == 10.0
        assert cfg.log_level == "DEBUG"


# ── DeviceAgent ────────────────────────────────────────────────────


class TestDeviceAgent:
    def _make_agent(self, tmp_path):
        cfg = AgentConfig(
            device_id="dev-1",
            api_key="key-1",
            server_url="http://localhost:8001",
            model_cache_dir=str(tmp_path / "models"),
            firmware_dir=str(tmp_path / "firmware"),
        )
        from fleet.agent.agent import DeviceAgent
        return DeviceAgent(cfg)

    def test_init(self, tmp_path):
        agent = self._make_agent(tmp_path)
        assert agent.config.device_id == "dev-1"
        assert agent.model_cache is not None
        assert agent.heartbeat is not None
        assert agent._running is False

    def test_stop(self, tmp_path):
        agent = self._make_agent(tmp_path)
        agent._running = True
        agent.heartbeat = MagicMock()

        agent.stop()

        assert agent._running is False
        agent.heartbeat.stop.assert_called_once()


# ── Command dispatch (Story 67) ───────────────────────────────────


class TestHandleCommands:
    @pytest.fixture()
    def agent(self, tmp_path):
        cfg = AgentConfig(
            device_id="dev-1",
            api_key="key-1",
            server_url="http://localhost:8001",
            model_cache_dir=str(tmp_path / "models"),
            firmware_dir=str(tmp_path / "firmware"),
        )
        from fleet.agent.agent import DeviceAgent
        a = DeviceAgent(cfg)
        a._report_command_result = AsyncMock()
        return a

    @pytest.mark.asyncio
    async def test_handle_commands_restart(self, agent):
        cmds = [{"id": "c1", "command_type": "restart", "payload": {}}]
        await agent._handle_commands(cmds)
        agent._report_command_result.assert_awaited_once_with("c1", {"status": "restarting"})

    @pytest.mark.asyncio
    async def test_handle_commands_deploy_model_cached(self, agent):
        agent.model_cache = MagicMock()
        agent.model_cache.has_version.return_value = True

        cmds = [{"id": "c2", "command_type": "deploy_model", "payload": {"model_version": "v1.0"}}]
        await agent._handle_commands(cmds)
        agent._report_command_result.assert_awaited_once_with("c2", {"status": "deployed", "version": "v1.0"})

    @pytest.mark.asyncio
    async def test_handle_commands_deploy_model_download(self, agent):
        agent.model_cache = MagicMock()
        agent.model_cache.has_version.return_value = False

        data = b"model-data-bytes"
        checksum = hashlib.sha256(data).hexdigest()

        mock_resp = AsyncMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.aiter_bytes = lambda chunk_size=None: _async_iter([data])

        mock_stream_ctx = AsyncMock()
        mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)

        mock_client = AsyncMock()
        mock_client.stream = MagicMock(return_value=mock_stream_ctx)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            cmds = [{
                "id": "c3",
                "command_type": "deploy_model",
                "payload": {
                    "model_version": "v2.0",
                    "model_url": "https://models.example.com/v2.pt",
                    "model_checksum": checksum,
                },
            }]
            await agent._handle_commands(cmds)

        agent.model_cache.store.assert_called_once_with("v2.0", data, checksum)
        agent._report_command_result.assert_awaited_once_with("c3", {"status": "deployed", "version": "v2.0"})

    @pytest.mark.asyncio
    async def test_handle_commands_deploy_model_missing_version(self, agent):
        cmds = [{"id": "c4", "command_type": "deploy_model", "payload": {}}]
        await agent._handle_commands(cmds)
        # Should report error since model_version is missing
        agent._report_command_result.assert_awaited()
        call_args = agent._report_command_result.call_args
        assert "error" in call_args[0][1]

    @pytest.mark.asyncio
    async def test_handle_commands_rollback_success(self, agent):
        agent.model_cache = MagicMock()
        agent.model_cache.rollback.return_value = "v0.9"

        cmds = [{"id": "c5", "command_type": "rollback_model", "payload": {}}]
        await agent._handle_commands(cmds)
        agent._report_command_result.assert_awaited_once_with("c5", {"status": "rolled_back", "version": "v0.9"})

    @pytest.mark.asyncio
    async def test_handle_commands_rollback_no_previous(self, agent):
        agent.model_cache = MagicMock()
        agent.model_cache.rollback.return_value = None

        cmds = [{"id": "c6", "command_type": "rollback_model", "payload": {}}]
        await agent._handle_commands(cmds)
        call_args = agent._report_command_result.call_args
        assert "error" in call_args[0][1]

    @pytest.mark.asyncio
    async def test_handle_commands_update_config(self, agent):
        cmds = [{"id": "c7", "command_type": "update_config", "payload": {"key": "value"}}]
        await agent._handle_commands(cmds)
        agent._report_command_result.assert_awaited_once_with("c7", {"status": "config_updated"})

    @pytest.mark.asyncio
    async def test_handle_commands_decommission(self, agent):
        agent.stop = MagicMock()

        cmds = [{"id": "c8", "command_type": "decommission", "payload": {"wipe_data": True}}]
        await agent._handle_commands(cmds)
        agent._report_command_result.assert_awaited_once_with("c8", {"status": "decommissioned"})
        agent.stop.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_commands_unknown_type(self, agent):
        cmds = [{"id": "c9", "command_type": "self_destruct", "payload": {}}]
        await agent._handle_commands(cmds)
        agent._report_command_result.assert_awaited_once_with(
            "c9", {"error": "Unknown command: self_destruct"}
        )

    @pytest.mark.asyncio
    async def test_handle_commands_multiple(self, agent):
        cmds = [
            {"id": "c10", "command_type": "restart", "payload": {}},
            {"id": "c11", "command_type": "update_config", "payload": {"k": "v"}},
        ]
        await agent._handle_commands(cmds)
        assert agent._report_command_result.await_count == 2


# ── HeartbeatSender (Story 66) ─────────────────────────────────────


class TestHeartbeatSender:
    def _make_sender(self, on_commands=None):
        cfg = AgentConfig(
            device_id="dev-hb",
            api_key="key-hb",
            server_url="http://localhost:8001",
            heartbeat_interval=10.0,
        )
        from fleet.agent.heartbeat import HeartbeatSender
        return HeartbeatSender(cfg, on_commands=on_commands)

    @pytest.mark.asyncio
    async def test_heartbeat_send(self):
        sender = self._make_sender()
        sender.monitor = MagicMock()

        from fleet.models import ResourceUsage
        sender.monitor.collect.return_value = ResourceUsage(cpu_percent=50.0, memory_percent=60.0)

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"pending_commands": []}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await sender._send_heartbeat()

        mock_client.post.assert_awaited_once()
        call_args = mock_client.post.call_args
        assert call_args[0][0] == "http://localhost:8001/heartbeats"
        assert call_args[1]["headers"]["X-Device-API-Key"] == "key-hb"

    @pytest.mark.asyncio
    async def test_heartbeat_pending_commands_callback(self):
        callback = AsyncMock()
        sender = self._make_sender(on_commands=callback)
        sender.monitor = MagicMock()

        from fleet.models import ResourceUsage
        sender.monitor.collect.return_value = ResourceUsage()

        pending = [{"id": "cmd-1", "command_type": "restart", "payload": {}}]
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"pending_commands": pending}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await sender._send_heartbeat()

        callback.assert_awaited_once_with(pending)

    @pytest.mark.asyncio
    async def test_heartbeat_no_callback_on_empty(self):
        callback = AsyncMock()
        sender = self._make_sender(on_commands=callback)
        sender.monitor = MagicMock()

        from fleet.models import ResourceUsage
        sender.monitor.collect.return_value = ResourceUsage()

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"pending_commands": []}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await sender._send_heartbeat()

        callback.assert_not_awaited()

    def test_heartbeat_stop(self):
        sender = self._make_sender()
        sender._running = True
        sender.stop()
        assert sender._running is False


# ── Report command result ──────────────────────────────────────────


class TestReportCommandResult:
    @pytest.mark.asyncio
    async def test_report_command_result(self, tmp_path):
        cfg = AgentConfig(
            device_id="dev-r",
            api_key="key-r",
            server_url="http://localhost:8001",
            model_cache_dir=str(tmp_path / "models"),
            firmware_dir=str(tmp_path / "firmware"),
        )
        from fleet.agent.agent import DeviceAgent
        agent = DeviceAgent(cfg)

        mock_client = AsyncMock()
        mock_client.post = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await agent._report_command_result("cmd-99", {"status": "done"})

        mock_client.post.assert_awaited_once()
        call_args = mock_client.post.call_args
        assert "/commands/cmd-99/complete" in call_args[0][0]
        assert call_args[1]["json"] == {"status": "done"}
        assert call_args[1]["headers"]["X-Device-API-Key"] == "key-r"

    @pytest.mark.asyncio
    async def test_report_command_result_network_error(self, tmp_path):
        cfg = AgentConfig(
            device_id="dev-r2",
            api_key="key-r2",
            server_url="http://localhost:8001",
            model_cache_dir=str(tmp_path / "models"),
            firmware_dir=str(tmp_path / "firmware"),
        )
        from fleet.agent.agent import DeviceAgent
        agent = DeviceAgent(cfg)

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=ConnectionError("network down"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            # Should not raise — exception is swallowed
            await agent._report_command_result("cmd-err", {"status": "done"})


# ── ResourceMonitor ────────────────────────────────────────────────


class TestResourceMonitor:
    def test_collect(self):
        from fleet.agent.resource_monitor import ResourceMonitor

        mock_psutil = MagicMock()
        mock_psutil.cpu_percent.return_value = 42.0
        mock_psutil.virtual_memory.return_value = MagicMock(
            percent=65.0, used=8 * (1024**3)
        )
        mock_psutil.disk_usage.return_value = MagicMock(
            percent=70.0, used=100 * (1024**3)
        )
        mock_psutil.sensors_temperatures.side_effect = AttributeError

        with patch("fleet.agent.resource_monitor.psutil", mock_psutil):
            monitor = ResourceMonitor()
            usage = monitor.collect()

        assert usage.cpu_percent == 42.0
        assert usage.memory_percent == 65.0
        assert usage.memory_used_gb == 8.0
        assert usage.disk_percent == 70.0
        assert usage.disk_used_gb == 100.0

    def test_no_psutil(self):
        from fleet.agent.resource_monitor import ResourceMonitor

        with patch("fleet.agent.resource_monitor.psutil", None):
            monitor = ResourceMonitor()
            usage = monitor.collect()

        assert usage.cpu_percent == 0
        assert usage.memory_percent == 0


# ── ModelCache ─────────────────────────────────────────────────────


class TestModelCache:
    def test_store_and_has_version(self, tmp_path):
        cache = ModelCache(cache_dir=str(tmp_path / "cache"))
        data = b"model-binary-data"

        cache.store("v1.0", data)

        assert cache.has_version("v1.0")
        assert cache.current_version == "v1.0"
        model_file = tmp_path / "cache" / "v1.0" / "model.bin"
        assert model_file.read_bytes() == data

    def test_checksum_ok(self, tmp_path):
        cache = ModelCache(cache_dir=str(tmp_path / "cache"))
        data = b"valid-data"
        checksum = hashlib.sha256(data).hexdigest()

        path = cache.store("v1.0", data, checksum)
        assert path.exists()

    def test_checksum_mismatch(self, tmp_path):
        cache = ModelCache(cache_dir=str(tmp_path / "cache"))
        data = b"some-data"

        with pytest.raises(ValueError, match="Checksum mismatch"):
            cache.store("v1.0", data, "0000000000000000000000000000000000000000000000000000000000000000")

    def test_rollback(self, tmp_path):
        cache = ModelCache(cache_dir=str(tmp_path / "cache"))
        cache.store("v1.0", b"first")
        cache.store("v2.0", b"second")

        assert cache.current_version == "v2.0"
        rolled = cache.rollback()
        assert rolled == "v1.0"
        assert cache.current_version == "v1.0"

    def test_rollback_no_previous(self, tmp_path):
        cache = ModelCache(cache_dir=str(tmp_path / "cache"))
        assert cache.rollback() is None

    def test_path_traversal(self, tmp_path):
        cache = ModelCache(cache_dir=str(tmp_path / "cache"))

        with pytest.raises(ValueError, match="Invalid version"):
            cache.store("../etc/passwd", b"evil")

        with pytest.raises(ValueError, match="Invalid version"):
            cache.store("foo/bar", b"evil")

        with pytest.raises(ValueError, match="Invalid version"):
            cache.store("foo\\bar", b"evil")

    def test_cleanup(self, tmp_path):
        cache = ModelCache(cache_dir=str(tmp_path / "cache"), max_versions=2)
        cache.store("v1", b"one")
        cache.store("v2", b"two")
        cache.store("v3", b"three")

        # v1 should have been cleaned up (max_versions=2 keeps current + previous)
        assert not (tmp_path / "cache" / "v1").exists()
        assert (tmp_path / "cache" / "v2").exists()
        assert (tmp_path / "cache" / "v3").exists()


# ── Async helper ───────────────────────────────────────────────────


async def _async_iter(items):
    """Helper to create an async iterator from a list."""
    for item in items:
        yield item
