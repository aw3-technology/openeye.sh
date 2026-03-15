"""RobotVision — high-level wrapper around the OpenEye PerceptionPipeline.

Designed for robot control loops: create, start, perceive frames, stop.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

from openeye_ai.robotics._pipeline_bridge import ensure_backend_path
from openeye_ai.robotics.config import DeploymentMode, RobotVisionConfig

logger = logging.getLogger(__name__)

class RobotVision:
    """Main entry-point for the OpenEye robotics SDK.

    Parameters
    ----------
    config : RobotVisionConfig
        Pipeline and deployment configuration.
    """

    def __init__(self, config: RobotVisionConfig | None = None) -> None:
        self._config = config or RobotVisionConfig()
        self._pipeline: Any = None
        self._adapter: Any = None
        self._remote_client: Any = None
        self._started = False

    # ------------------------------------------------------------------ #
    #  Lifecycle
    # ------------------------------------------------------------------ #

    def start(self) -> None:
        """Initialise models and pipeline. Must be called before :meth:`perceive`."""
        if self._started:
            return

        cfg = self._config

        if cfg.mode == DeploymentMode.REMOTE:
            from openeye_ai.robotics.client import RemoteVisionClient

            self._remote_client = RemoteVisionClient(
                server_url=cfg.server_url,
                grpc_address=cfg.grpc_address,
            )
            self._remote_client.connect()
            self._started = True
            logger.info("RobotVision started in REMOTE mode")
            return

        # LOCAL or SERVER — load models and create pipeline
        ensure_backend_path()
        from perception.pipeline import PerceptionPipeline

        from openeye_ai.registry import get_adapter

        self._adapter = get_adapter(cfg.model, variant=cfg.variant)

        def _detect(frame_np: np.ndarray) -> list[dict]:
            from PIL import Image

            img = Image.fromarray(frame_np)
            return self._adapter.predict(img).get("objects", [])

        depth_estimator = None
        if cfg.depth_enabled:
            try:
                depth_adapter = get_adapter("depth_anything")
                depth_estimator = depth_adapter.predict
            except Exception:
                logger.warning("Depth model not available; depth disabled")

        self._pipeline = PerceptionPipeline(
            detector=_detect,
            depth_estimator=depth_estimator,
            danger_m=cfg.danger_m,
            caution_m=cfg.caution_m,
        )
        self._started = True
        mode_label = cfg.mode.value.upper()
        logger.info("RobotVision started in %s mode (model=%s)", mode_label, cfg.model)

    def stop(self) -> None:
        """Release resources."""
        if self._remote_client is not None:
            self._remote_client.close()
            self._remote_client = None
        self._pipeline = None
        self._adapter = None
        self._started = False
        logger.info("RobotVision stopped")

    # ------------------------------------------------------------------ #
    #  Perception
    # ------------------------------------------------------------------ #

    def perceive(
        self,
        frame: np.ndarray,
        depth_map: np.ndarray | None = None,
    ) -> Any:
        """Run the full perception pipeline on a single frame.

        Parameters
        ----------
        frame : np.ndarray
            Camera frame (H, W, 3) in RGB uint8.
        depth_map : np.ndarray, optional
            Depth map (H, W) in metres.

        Returns
        -------
        PerceptionFrame
            Unified perception output.
        """
        self._ensure_started()

        if self._config.mode == DeploymentMode.REMOTE:
            return self._remote_client.perceive(frame, depth_map)

        return self._pipeline.process_frame(frame=frame, depth_map=depth_map)

    # ------------------------------------------------------------------ #
    #  Convenience helpers
    # ------------------------------------------------------------------ #

    def set_goal(self, goal: str) -> None:
        """Update the robot's current goal for action suggestions."""
        self._ensure_started()
        if self._pipeline is not None:
            self._pipeline.set_goal(goal)

    def set_roi(self, roi: Any) -> None:
        """Set or clear the region-of-interest for focused perception."""
        self._ensure_started()
        if self._pipeline is not None:
            self._pipeline.set_roi(roi)

    def is_safe(self) -> bool:
        """Quick check: are there any DANGER-level safety alerts?"""
        self._ensure_started()
        if self._pipeline is None or self._pipeline.last_frame is None:
            return True
        ensure_backend_path()
        from perception.models import ZoneLevel

        return not any(
            a.zone == ZoneLevel.DANGER
            for a in self._pipeline.last_frame.safety_alerts
        )

    def get_nearest_human(self) -> tuple[Any, float] | None:
        """Return the nearest safety zone and its distance, or None."""
        self._ensure_started()
        if self._pipeline is None or self._pipeline.last_frame is None:
            return None
        zones = self._pipeline.last_frame.safety_zones
        if not zones:
            return None
        nearest = min(zones, key=lambda z: z.distance_m)
        return nearest, nearest.distance_m

    def get_grasp_points(self, label: str) -> list[Any]:
        """Return grasp points for objects matching *label*."""
        self._ensure_started()
        if self._pipeline is None or self._pipeline.last_frame is None:
            return []
        points: list[Any] = []
        for obj in self._pipeline.last_frame.objects:
            if obj.label.lower() == label.lower():
                points.extend(obj.grasp_points)
        return points

    def query(self, question: str) -> Any:
        """Natural-language query about the current scene."""
        self._ensure_started()
        if self._pipeline is not None:
            return self._pipeline.query(question)
        return None

    @property
    def last_frame(self) -> Any:
        """The most recent PerceptionFrame, or ``None``."""
        if self._pipeline is not None:
            return self._pipeline.last_frame
        return None

    # ------------------------------------------------------------------ #
    #  Internal
    # ------------------------------------------------------------------ #

    def _ensure_started(self) -> None:
        if not self._started:
            raise RuntimeError(
                "RobotVision not started. Call vision.start() first."
            )
