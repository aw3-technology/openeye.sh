"""WebSocket integration tests for /ws/agentic and additional /ws/* coverage."""

from __future__ import annotations

import base64
import io
import json
import time
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image

from openeye_ai.server.agentic_session import AgenticConfig, AgenticSession


# ── Helpers ──────────────────────────────────────────────────────────


def _b64_image(w: int = 10, h: int = 10) -> str:
    """Return base64-encoded JPEG bytes."""
    img = Image.new("RGB", (w, h), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()


# ── AgenticSession unit tests ────────────────────────────────────────


class TestAgenticSession:
    def _make_session(self, **kwargs):
        return AgenticSession(
            vlm_client=kwargs.get("vlm_client"),
            vlm_model=kwargs.get("vlm_model", "test-model"),
            config=kwargs.get("config"),
        )

    def test_initial_state(self):
        session = self._make_session()
        assert session.frame_count == 0
        assert session.current_goal == ""
        assert session.objects_seen == {}
        assert session.timeline == []
        assert session.last_vlm_time == 0.0
        assert session.last_vlm_result is None

    def test_add_timeline_event(self):
        session = self._make_session()
        session.add_timeline_event("test_event", "details here")
        assert len(session.timeline) == 1
        assert session.timeline[0]["event"] == "test_event"
        assert session.timeline[0]["details"] == "details here"
        assert "timestamp" in session.timeline[0]

    def test_timeline_max_limit(self):
        config = AgenticConfig(timeline_max=3)
        session = self._make_session(config=config)
        for i in range(5):
            session.add_timeline_event(f"event_{i}", str(i))
        assert len(session.timeline) == 3
        assert session.timeline[0]["event"] == "event_2"

    def test_update_memory_new_objects(self):
        session = self._make_session()
        objects = [
            {"track_id": "t1", "label": "person"},
            {"track_id": "t2", "label": "car"},
        ]
        changes = session.update_memory(objects)
        assert len(changes) == 2
        assert changes[0]["type"] == "appeared"
        assert changes[0]["track_id"] == "t1"
        assert changes[1]["type"] == "appeared"
        assert changes[1]["track_id"] == "t2"
        assert len(session.objects_seen) == 2

    def test_update_memory_existing_objects(self):
        session = self._make_session()
        objects = [{"track_id": "t1", "label": "person"}]
        session.update_memory(objects)
        # Second update with same object
        changes = session.update_memory(objects)
        assert len(changes) == 0  # no new appearances
        assert session.objects_seen["t1"]["count"] == 2

    def test_update_memory_disappearance(self):
        config = AgenticConfig(disappear_threshold=0.5)
        session = self._make_session(config=config)
        # Object appears
        session.update_memory([{"track_id": "t1", "label": "person"}])
        # Force time to pass — set last_seen to just past the threshold
        # The disappearance window is (threshold, threshold + 1.0)
        session.objects_seen["t1"]["last_seen"] = time.time() - 0.8
        # Object disappears
        changes = session.update_memory([])
        disappeared = [c for c in changes if c["type"] == "disappeared"]
        assert len(disappeared) == 1
        assert disappeared[0]["label"] == "person"

    def test_build_memory_payload(self):
        session = self._make_session()
        session.frame_count = 5
        session.update_memory([{"track_id": "t1", "label": "person"}])
        session.add_timeline_event("test", "detail")

        payload = session.build_memory_payload()
        assert "objects_seen" in payload
        assert "timeline" in payload
        assert payload["frame_count"] == 5
        assert payload["total_objects_tracked"] == 1

    def test_build_active_objects_snapshot_filters_stale(self):
        config = AgenticConfig(active_object_window=5.0)
        session = self._make_session(config=config)
        session.objects_seen = {
            "t1": {"label": "person", "first_seen": time.time(), "last_seen": time.time(), "count": 1},
            "t2": {"label": "car", "first_seen": time.time() - 100, "last_seen": time.time() - 100, "count": 1},
        }
        snapshot = session.build_active_objects_snapshot()
        assert "t1" in snapshot
        assert "t2" not in snapshot

    def test_run_vlm_reasoning_no_client(self):
        import asyncio
        session = self._make_session(vlm_client=None)
        result = asyncio.get_event_loop().run_until_complete(
            session.run_vlm_reasoning("base64data", "scene desc", "goal")
        )
        assert "not configured" in result["description"].lower()
        assert result["latency_ms"] == 0

    def test_run_vlm_reasoning_success(self):
        import asyncio
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock()]
        mock_resp.choices[0].message.content = "OBSERVATION: test scene"
        mock_client.chat.completions.create.return_value = mock_resp

        session = self._make_session(vlm_client=mock_client, vlm_model="test-vlm")
        result = asyncio.get_event_loop().run_until_complete(
            session.run_vlm_reasoning("b64", "desc", "find object")
        )
        assert result["description"] == "OBSERVATION: test scene"
        assert "test-vlm" in result["reasoning"]
        assert result["latency_ms"] >= 0

    def test_run_vlm_reasoning_timeout(self):
        import asyncio

        async def slow_create(*args, **kwargs):
            await asyncio.sleep(100)

        mock_client = AsyncMock()
        mock_client.chat.completions.create.side_effect = slow_create

        config = AgenticConfig(vlm_timeout=0.01)
        session = self._make_session(vlm_client=mock_client, config=config)
        result = asyncio.get_event_loop().run_until_complete(
            session.run_vlm_reasoning("b64", "desc", "goal")
        )
        assert "timed out" in result["description"].lower()

    def test_run_vlm_reasoning_error(self):
        import asyncio
        mock_client = AsyncMock()
        mock_client.chat.completions.create.side_effect = RuntimeError("API error")

        session = self._make_session(vlm_client=mock_client)
        result = asyncio.get_event_loop().run_until_complete(
            session.run_vlm_reasoning("b64", "desc", "goal")
        )
        assert "failed" in result["description"].lower()

    def test_goal_update(self):
        session = self._make_session()
        session.current_goal = "find the red ball"
        session.add_timeline_event("goal_updated", "find the red ball")
        assert session.current_goal == "find the red ball"
        assert session.timeline[-1]["event"] == "goal_updated"

    def test_timeline_tail_in_memory_payload(self):
        config = AgenticConfig(timeline_tail=3)
        session = self._make_session(config=config)
        for i in range(10):
            session.add_timeline_event(f"ev_{i}", str(i))
        payload = session.build_memory_payload()
        assert len(payload["timeline"]) == 3
        assert payload["timeline"][0]["event"] == "ev_7"


# ── WebSocket /ws/agentic endpoint tests ─────────────────────────────


class TestWebSocketAgentic:
    """Integration tests for the /ws/agentic WebSocket endpoint."""

    @pytest.fixture()
    def agentic_client(self, app_client):
        """Reuse the app_client fixture from conftest."""
        return app_client

    def test_agentic_ping_pong(self, agentic_client):
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            ws.send_text("ping")
            resp = ws.receive_text()
            assert resp == "pong"

    def test_agentic_raw_base64_frame(self, agentic_client):
        """Backwards-compat: raw base64 string should work."""
        b64 = _b64_image()
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            ws.send_text(b64)
            data = ws.receive_json()
            assert data["type"] == "agentic_frame"
            assert "detections" in data
            assert "memory" in data
            assert "latency" in data
            assert data["frame_id"] == 1

    def test_agentic_json_frame(self, agentic_client):
        """JSON message with frame field."""
        msg = json.dumps({"frame": _b64_image()})
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            ws.send_text(msg)
            data = ws.receive_json()
            assert data["type"] == "agentic_frame"

    def test_agentic_set_goal(self, agentic_client):
        msg = json.dumps({"frame": _b64_image(), "set_goal": "find the red box"})
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            ws.send_text(msg)
            data = ws.receive_json()
            assert data["goal"] == "find the red box"

    def test_agentic_goal_persistence(self, agentic_client):
        """Goal should persist across frames."""
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            # Set goal on first frame
            ws.send_text(json.dumps({"frame": _b64_image(), "set_goal": "watch door"}))
            data1 = ws.receive_json()
            assert data1["goal"] == "watch door"

            # Second frame without set_goal — goal should persist
            ws.send_text(json.dumps({"frame": _b64_image()}))
            data2 = ws.receive_json()
            assert data2["goal"] == "watch door"
            assert data2["frame_id"] == 2

    def test_agentic_empty_frame(self, agentic_client):
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            ws.send_text(json.dumps({"goal": "test"}))
            data = ws.receive_json()
            assert "error" in data

    def test_agentic_invalid_image(self, agentic_client):
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            ws.send_text(json.dumps({"frame": "not-valid-base64!!!"}))
            data = ws.receive_json()
            assert "error" in data

    def test_agentic_response_structure(self, agentic_client):
        """Verify full response structure."""
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            ws.send_text(json.dumps({"frame": _b64_image()}))
            data = ws.receive_json()

            required_keys = {
                "type", "frame_id", "goal", "detections", "scene_graph",
                "scene_description", "vlm_reasoning", "action_plan",
                "safety_zones", "safety_alerts", "change_alerts",
                "memory", "latency",
            }
            assert required_keys.issubset(data.keys())

            # Memory structure
            assert "objects_seen" in data["memory"]
            assert "timeline" in data["memory"]
            assert "frame_count" in data["memory"]
            assert "total_objects_tracked" in data["memory"]

            # Latency structure
            assert "detection_ms" in data["latency"]
            assert "vlm_ms" in data["latency"]
            assert "total_ms" in data["latency"]

    def test_agentic_multiple_frames_increments_frame_id(self, agentic_client):
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            for expected_id in range(1, 4):
                ws.send_text(json.dumps({"frame": _b64_image()}))
                data = ws.receive_json()
                assert data["frame_id"] == expected_id

    def test_agentic_memory_tracks_objects(self, agentic_client):
        """Memory should track detected objects across frames."""
        with agentic_client.websocket_connect("/ws/agentic") as ws:
            # Send multiple frames
            for _ in range(3):
                ws.send_text(json.dumps({"frame": _b64_image()}))
                ws.receive_json()

            # Final frame — check memory
            ws.send_text(json.dumps({"frame": _b64_image()}))
            data = ws.receive_json()
            assert data["memory"]["frame_count"] == 4
