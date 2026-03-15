"""Shared server state — holds adapter, queues, config, and helpers."""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import numpy as np

from openeye_ai._backend import ensure_backend_path
from openeye_ai.server.queue import InferenceQueue

ensure_backend_path()

logger = logging.getLogger(__name__)

# Max upload size: 20 MB
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


class AppState:
    """Centralised runtime state shared across all route modules."""

    def __init__(
        self,
        adapter,
        model_name: str,
        model_info: dict[str, Any],
        vlm_model: str | None = None,
        cortex_llm: str | None = None,
    ) -> None:
        self.adapter = adapter
        self.model_name = model_name
        self.model_info = model_info
        self.inference_queue = InferenceQueue(max_concurrent=1, max_queue_size=16)
        self.start_time = time.time()

        # Mutable runtime config (seeded from CLI flags)
        self.runtime_config: dict[str, Any] = {}
        if vlm_model:
            self.runtime_config["vlm_model"] = vlm_model
        if cortex_llm:
            self.runtime_config["cortex_llm"] = cortex_llm

        # Nebius VLM usage tracking (shared across connections)
        self.nebius_stats: dict[str, Any] = {
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

        # Lazy-init perception pipeline & governance
        self._pipeline = None
        self._governance_engine = None

    # -------------------------------------------------------------- #
    #  Pipeline / governance helpers
    # -------------------------------------------------------------- #

    def _init_governance(self):
        if self._governance_engine is not None:
            return self._governance_engine
        gov_config = self.runtime_config.get("governance_config")
        if gov_config:
            try:
                from governance.engine import GovernanceEngine

                self._governance_engine = GovernanceEngine(config_path=gov_config)
                logger.info("Governance engine loaded: %s", gov_config)
            except Exception as e:
                logger.warning("Failed to init governance engine: %s", e)
        return self._governance_engine

    def get_pipeline(self):
        if self._pipeline is None:
            try:
                from perception.pipeline import PerceptionPipeline
                from PIL import Image

                def detector_fn(frame_np):
                    img = Image.fromarray(frame_np)
                    return self.adapter.predict(img).get("objects", [])

                gov = self._init_governance()
                self._pipeline = PerceptionPipeline(
                    detector=detector_fn, governance_engine=gov
                )
            except ImportError as e:
                logger.warning("PerceptionPipeline not available: %s", e)
                return None
        return self._pipeline

    # -------------------------------------------------------------- #
    #  VLM model resolution
    # -------------------------------------------------------------- #

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
            base_url = os.environ.get(
                "NEBIUS_BASE_URL", "https://api.studio.nebius.com/v1"
            )

        return api_key, base_url, model

    # -------------------------------------------------------------- #
    #  Bbox normalisation helpers
    # -------------------------------------------------------------- #

    @staticmethod
    def bbox2d_to_norm(bbox_dict: dict, img_w: int, img_h: int) -> dict:
        """Convert BBox2D (x1,y1,x2,y2 pixels) → BBox (x,y,w,h normalized)."""
        x1, y1 = bbox_dict.get("x1", 0), bbox_dict.get("y1", 0)
        x2, y2 = bbox_dict.get("x2", 0), bbox_dict.get("y2", 0)
        return {
            "x": x1 / img_w if img_w else 0,
            "y": y1 / img_h if img_h else 0,
            "w": (x2 - x1) / img_w if img_w else 0,
            "h": (y2 - y1) / img_h if img_h else 0,
        }

    @staticmethod
    def normalize_frame_bboxes(frame_dict: dict, img_w: int, img_h: int) -> dict:
        """Normalize all BBox2D in a PerceptionFrame dict to BBox format."""
        for obj in frame_dict.get("objects", []):
            if "bbox" in obj and "x1" in obj["bbox"]:
                obj["bbox"] = AppState.bbox2d_to_norm(obj["bbox"], img_w, img_h)
        return frame_dict
