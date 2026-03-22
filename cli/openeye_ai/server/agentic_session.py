"""Agentic session state and logic extracted from the /ws/agentic endpoint."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class AgenticConfig:
    """Magic numbers for the agentic loop."""

    vlm_interval: float = 3.0
    timeline_max: int = 50
    timeline_tail: int = 10
    disappear_threshold: float = 2.0
    active_object_window: float = 10.0
    vlm_timeout: float = 10.0
    vlm_max_tokens: int = 300


class AgenticSession:
    """Per-connection state and logic for the agentic WebSocket loop.

    Manages object memory, timeline events, VLM reasoning throttling,
    and snapshot building — all previously inline closures over shared
    mutable state in ``websocket_agentic()``.
    """

    def __init__(
        self,
        vlm_client: Any | None,
        vlm_model: str,
        config: AgenticConfig | None = None,
    ) -> None:
        self.vlm_client = vlm_client
        self.vlm_model = vlm_model
        self.cfg = config or AgenticConfig()

        # Per-connection mutable state
        self.current_goal: str = ""
        self.objects_seen: dict[str, dict[str, Any]] = {}
        self.timeline: list[dict[str, Any]] = []
        self.frame_count: int = 0
        self.last_vlm_time: float = 0.0
        self.last_vlm_result: Optional[dict[str, Any]] = None

    # ── Timeline ────────────────────────────────────────────────── #

    def add_timeline_event(self, event: str, details: str) -> None:
        self.timeline.append({
            "timestamp": time.time(),
            "event": event,
            "details": details,
        })
        if len(self.timeline) > self.cfg.timeline_max:
            self.timeline.pop(0)

    # ── Object memory ───────────────────────────────────────────── #

    def update_memory(self, objects: list[dict]) -> list[dict]:
        """Track objects across frames. Returns change events."""
        now = time.time()
        changes: list[dict] = []
        current_ids: set[str] = set()

        for obj in objects:
            tid = obj.get("track_id", "")
            label = obj.get("label", "unknown")
            current_ids.add(tid)

            if tid not in self.objects_seen:
                self.objects_seen[tid] = {
                    "label": label,
                    "first_seen": now,
                    "last_seen": now,
                    "count": 1,
                }
                changes.append({"type": "appeared", "track_id": tid, "label": label})
                self.add_timeline_event("object_appeared", f"{label} (ID: {tid})")
            else:
                self.objects_seen[tid]["last_seen"] = now
                self.objects_seen[tid]["count"] += 1

        # Detect disappearances
        for tid, info in list(self.objects_seen.items()):
            if tid not in current_ids and (now - info["last_seen"]) > self.cfg.disappear_threshold:
                if (now - info["last_seen"]) < self.cfg.disappear_threshold + 1.0:
                    changes.append({"type": "disappeared", "track_id": tid, "label": info["label"]})
                    self.add_timeline_event("object_disappeared", f"{info['label']} (ID: {tid})")

        return changes

    # ── VLM reasoning ───────────────────────────────────────────── #

    async def run_vlm_reasoning(self, frame_b64: str, scene_desc: str, goal: str) -> dict:
        """Send frame to VLM for high-level reasoning."""
        if not self.vlm_client:
            return {
                "description": "VLM not configured (missing NEBIUS_API_KEY).",
                "reasoning": "",
                "latency_ms": 0,
            }

        goal_context = f" Current goal: {goal}." if goal else ""
        objects_summary = ", ".join(
            f"{info['label']}" for info in self.objects_seen.values()
            if (time.time() - info["last_seen"]) < 5.0
        )

        t0 = time.time()
        try:
            resp = await asyncio.wait_for(
                self.vlm_client.chat.completions.create(
                    model=self.vlm_model,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are OpenEye, an autonomous perception agent.\n"
                                f"Context: {scene_desc} | Objects: {objects_summary}\n"
                                f"{goal_context}\n\n"
                                "Respond exactly:\n"
                                "OBSERVATION: [what you see now]\n"
                                "ANALYSIS: [relevance to goal]\n"
                                "NEXT_ACTION: [specific recommendation]\n"
                                "CONFIDENCE: [HIGH/MEDIUM/LOW]"
                            ),
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{frame_b64}"},
                                },
                                {"type": "text", "text": f"Analyze this frame. Goal: {goal or 'observe and describe'}"},
                            ],
                        },
                    ],
                    max_tokens=self.cfg.vlm_max_tokens,
                ),
                timeout=self.cfg.vlm_timeout,
            )
            latency = (time.time() - t0) * 1000
            content = resp.choices[0].message.content or ""
            return {
                "description": content,
                "reasoning": f"Analyzed by {self.vlm_model}",
                "latency_ms": round(latency, 1),
            }
        except asyncio.TimeoutError:
            return {
                "description": "VLM reasoning timed out.",
                "reasoning": f"Timeout after {self.cfg.vlm_timeout}s",
                "latency_ms": round((time.time() - t0) * 1000, 1),
            }
        except Exception as e:
            logger.error("Agentic VLM error: %s", e)
            return {
                "description": "VLM reasoning failed.",
                "reasoning": "",
                "latency_ms": round((time.time() - t0) * 1000, 1),
            }

    # ── Snapshots ───────────────────────────────────────────────── #

    def build_active_objects_snapshot(self) -> dict:
        """Return recently-seen objects for the response payload."""
        now = time.time()
        return {
            tid: {
                "label": info["label"],
                "frames_seen": info["count"],
                "seconds_tracked": round(now - info["first_seen"], 1),
            }
            for tid, info in self.objects_seen.items()
            if (now - info["last_seen"]) < self.cfg.active_object_window
        }

    def build_memory_payload(self) -> dict:
        """Build the ``memory`` dict for the WS response."""
        return {
            "objects_seen": self.build_active_objects_snapshot(),
            "timeline": self.timeline[-self.cfg.timeline_tail:],
            "frame_count": self.frame_count,
            "total_objects_tracked": len(self.objects_seen),
        }
