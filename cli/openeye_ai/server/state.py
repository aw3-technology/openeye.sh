"""Shared server state for the OpenEye inference server."""

from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from openeye_ai.server.queue import InferenceQueue

# Add backend/src to path for perception pipeline imports
_BACKEND_SRC = str(Path(__file__).resolve().parents[3] / "backend" / "src")
if _BACKEND_SRC not in sys.path:
    sys.path.insert(0, _BACKEND_SRC)

logger = logging.getLogger(__name__)

# Nebius VLM usage tracking (shared across connections, imported by reference)
nebius_stats: dict[str, Any] = {
    "total_calls": 0,
    "total_tokens_estimated": 0,
    "total_latency_ms": 0.0,
    "avg_latency_ms": 0.0,
    "errors": 0,
    "last_call_at": None,
    "model": "",
    "provider": "Nebius Token Factory",
    "configured": False,
}


@dataclass
class ServerState:
    """Shared mutable state for all server routes."""

    adapter: Any
    model_name: str
    model_info: dict[str, Any]
    inference_queue: InferenceQueue
    runtime_config: dict[str, Any] = field(default_factory=dict)
    start_time: float = 0.0
    pipeline: Any = None
    governance_engine: Any = None
    _set_governance_engine: Any = None  # callable from governance.router

    def resolve_vlm_model(self) -> tuple[str, str, str]:
        """Resolve VLM provider config: (api_key, base_url, model).

        Priority: runtime config vlm_model > CLI flag > NEBIUS_MODEL env > default.
        Auto-detects provider (OpenRouter vs Nebius) from the model ID format.
        """
        cfg_model = self.runtime_config.get("vlm_model", "")
        env_model = os.environ.get("NEBIUS_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct")
        model = cfg_model or env_model

        # OpenRouter model IDs use lowercase org/model or contain ":free"
        is_openrouter = "/" in model and (
            model.split("/")[0].islower() or ":free" in model
        )

        if is_openrouter:
            api_key = os.environ.get("OPENROUTER_API_KEY", "")
            base_url = "https://openrouter.ai/api/v1"
        else:
            api_key = os.environ.get("NEBIUS_API_KEY", "")
            base_url = os.environ.get("NEBIUS_BASE_URL", "https://api.studio.nebius.com/v1")

        return api_key, base_url, model

    def init_governance(self) -> Any:
        """Lazily initialize the governance engine."""
        if self.governance_engine is not None:
            return self.governance_engine
        gov_config = self.runtime_config.get("governance_config")
        if gov_config:
            try:
                from governance.engine import GovernanceEngine

                self.governance_engine = GovernanceEngine(config_path=gov_config)
                if self._set_governance_engine is not None:
                    self._set_governance_engine(self.governance_engine)
                logger.info("Governance engine loaded: %s", gov_config)
            except Exception as e:
                logger.warning("Failed to init governance engine: %s", e)
        return self.governance_engine

    def get_pipeline(self) -> Any:
        """Lazily initialize the perception pipeline."""
        if self.pipeline is None:
            try:
                from perception.pipeline import PerceptionPipeline

                adapter = self.adapter

                def detector_fn(frame_np):
                    from PIL import Image

                    img = Image.fromarray(frame_np)
                    return adapter.predict(img).get("objects", [])

                gov = self.init_governance()
                self.pipeline = PerceptionPipeline(detector=detector_fn, governance_engine=gov)
            except ImportError as e:
                logger.warning(f"PerceptionPipeline not available: {e}")
                return None
        return self.pipeline


def get_state(request_or_ws) -> ServerState:
    """Get ServerState from a Request or WebSocket."""
    return request_or_ws.app.state.server


def bbox2d_to_norm(bbox_dict: dict, img_w: int, img_h: int) -> dict:
    """Convert BBox2D (x1,y1,x2,y2 pixels) -> BBox (x,y,w,h normalized)."""
    x1, y1 = bbox_dict.get("x1", 0), bbox_dict.get("y1", 0)
    x2, y2 = bbox_dict.get("x2", 0), bbox_dict.get("y2", 0)
    return {
        "x": x1 / img_w if img_w else 0,
        "y": y1 / img_h if img_h else 0,
        "w": (x2 - x1) / img_w if img_w else 0,
        "h": (y2 - y1) / img_h if img_h else 0,
    }


def normalize_frame_bboxes(frame_dict: dict, img_w: int, img_h: int) -> dict:
    """Normalize all BBox2D in a PerceptionFrame dict to BBox format."""
    for obj in frame_dict.get("objects", []):
        if "bbox" in obj and "x1" in obj["bbox"]:
            obj["bbox"] = bbox2d_to_norm(obj["bbox"], img_w, img_h)
    return frame_dict
