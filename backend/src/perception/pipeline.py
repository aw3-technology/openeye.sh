"""Unified Perception Pipeline — orchestrates all perception stages.

Covers all stories 46-60:
  46 - Unified perception output per frame
  47 - 3D position estimates when depth available
  48 - Spatial relationships between objects
  49 - Object tracking with consistent IDs
  50 - Scene graph data structure
  51 - Action suggestions based on scene + goal
  52 - Safety alerts (Safety Guardian)
  53 - Zone-based awareness (safe/caution/danger)
  54 - Sub-100ms latency with YOLO
  55 - Region-of-interest focused perception
  56 - Change detection alerts
  57 - Grasp point suggestions
  58 - Floor plane estimation
  59 - Varied lighting robustness (handled by model config)
  60 - Natural language queries
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

import numpy as np

from perception.change_detector import ChangeDetector
from perception.models import (
    NLQueryResult,
    PerceptionFrame,
    RegionOfInterest,
)
from perception.object_builder import build_objects_3d
from perception.preprocessing import apply_roi, normalize_lighting, unmap_roi_detections
from perception.query import PerceptionQueryEngine
from perception.safety import SafetyGuardian
from perception.scene_describer import generate_scene_description, suggest_actions
from perception.scene_graph import (
    build_scene_graph,
    derive_spatial_relationships,
    estimate_floor_plane,
)
from perception.tracker import ObjectTracker


class PerceptionPipeline:
    """Orchestrates detection → tracking → 3D → scene graph → safety → output.

    Parameters
    ----------
    detector : callable or None
        A callable that takes a frame (np.ndarray) and returns a list of
        detection dicts with keys: label, confidence, bbox.
        If None, detections must be provided directly to ``process_frame``.
    depth_estimator : callable or None
        A callable that takes a frame (np.ndarray) and returns a depth map
        (np.ndarray, HxW in metres or normalised).
    iou_threshold : float
        IoU threshold for object tracking.
    danger_m : float
        Safety Guardian danger zone radius in metres.
    caution_m : float
        Safety Guardian caution zone radius in metres.
    robot_goal : str
        Current robot goal for action suggestion context.
    lighting_robustness : bool
        When True, applies preprocessing for varied lighting (story 59).
    """

    def __init__(
        self,
        detector: Any = None,
        depth_estimator: Any = None,
        iou_threshold: float = 0.3,
        danger_m: float = 0.5,
        caution_m: float = 1.5,
        robot_goal: str = "",
        lighting_robustness: bool = True,
        governance_engine: Any = None,
    ):
        self.detector = detector
        self.depth_estimator = depth_estimator
        self.tracker = ObjectTracker(iou_threshold=iou_threshold)
        self.safety = SafetyGuardian(danger_m=danger_m, caution_m=caution_m)
        self.change_detector = ChangeDetector()
        self.query_engine = PerceptionQueryEngine()
        self.robot_goal = robot_goal
        self.lighting_robustness = lighting_robustness
        self.governance_engine = governance_engine

        self._frame_counter = 0
        self._roi: Optional[RegionOfInterest] = None
        self._last_frame: Optional[PerceptionFrame] = None

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #

    def set_roi(self, roi: Optional[RegionOfInterest]) -> None:
        """Set or clear the region of interest for focused perception (story 55)."""
        self._roi = roi

    def set_goal(self, goal: str) -> None:
        """Update the robot's current goal for action suggestions (story 51)."""
        self.robot_goal = goal

    def process_frame(
        self,
        frame: Optional[np.ndarray] = None,
        detections: Optional[list[dict]] = None,
        depth_map: Optional[np.ndarray] = None,
    ) -> PerceptionFrame:
        """Run the full perception pipeline on a single frame.

        Parameters
        ----------
        frame : np.ndarray or None
            Raw camera frame (H, W, 3). Required if no ``detections`` provided.
        detections : list[dict] or None
            Pre-computed detections. Each dict must have: label, confidence, bbox.
        depth_map : np.ndarray or None
            Depth map. If None and depth_estimator is set, computed from frame.

        Returns
        -------
        PerceptionFrame
            Unified perception output for this frame.
        """
        t0 = time.perf_counter()
        self._frame_counter += 1

        frame_h, frame_w = 0, 0
        if frame is not None:
            frame_h, frame_w = frame.shape[:2]

        # --- Story 55: Apply ROI crop ---
        active_roi = self._roi
        working_frame = frame
        if active_roi and frame is not None:
            working_frame = apply_roi(frame, active_roi)

        # --- Story 59: Lighting robustness preprocessing ---
        if self.lighting_robustness and working_frame is not None:
            working_frame = normalize_lighting(working_frame)

        # --- Detection ---
        if detections is None and self.detector is not None and working_frame is not None:
            detections = self.detector(working_frame)
        if detections is None:
            detections = []

        # If ROI was used, map bbox coordinates back to full frame
        if active_roi and frame is not None:
            detections = unmap_roi_detections(detections, active_roi, frame_w, frame_h)

        # --- Depth estimation ---
        if depth_map is None and self.depth_estimator is not None and frame is not None:
            depth_map = self.depth_estimator(frame)

        # --- Story 49: Object tracking ---
        tracked = self.tracker.update(detections)

        # --- Story 47: 3D positions + Story 57: grasp points ---
        objects_3d = build_objects_3d(tracked, depth_map, frame_w, frame_h)

        # --- Story 58: Floor plane ---
        floor = estimate_floor_plane(objects_3d, depth_map)

        # --- Stories 48, 50: Spatial relationships + scene graph ---
        relationships = derive_spatial_relationships(objects_3d)
        scene_graph = build_scene_graph(objects_3d, relationships)

        # --- Scene description ---
        scene_desc = generate_scene_description(objects_3d, relationships)

        # --- Stories 52, 53: Safety ---
        safety_alerts, safety_zones = self.safety.evaluate(objects_3d)

        # --- Story 56: Change detection ---
        change_alerts = self.change_detector.detect(objects_3d)

        # --- Story 51: Action suggestions ---
        action_suggestions = suggest_actions(objects_3d, safety_alerts, self.robot_goal)

        # --- Governance evaluation ---
        governance_verdict_dict = None
        if self.governance_engine is not None:
            try:
                from governance.context import GovernanceContext, RoboticsContext
                gov_context = GovernanceContext(
                    frame_id=self._frame_counter,
                    timestamp=time.time(),
                    robotics=RoboticsContext(
                        objects=objects_3d,
                        scene_graph=scene_graph,
                        safety_alerts=safety_alerts,
                        safety_zones=safety_zones,
                        action_suggestions=action_suggestions,
                        current_goal=self.robot_goal,
                    ),
                )
                verdict = self.governance_engine.evaluate(gov_context)
                governance_verdict_dict = verdict.model_dump(mode="json")
                # Filter out denied actions
                if verdict.denied_actions:
                    denied_set = set(verdict.denied_actions)
                    action_suggestions = [
                        a for a in action_suggestions
                        if a.target_id not in denied_set
                    ]
            except Exception as exc:
                logging.error("Governance evaluation error: %s", exc)

        # --- Story 54: Latency tracking ---
        elapsed_ms = (time.perf_counter() - t0) * 1000

        if elapsed_ms > 100:
            logging.warning(f"Perception latency {elapsed_ms:.1f}ms exceeds 100ms target")

        result = PerceptionFrame(
            frame_id=self._frame_counter,
            timestamp=time.time(),
            inference_ms=round(elapsed_ms, 2),
            objects=objects_3d,
            scene_graph=scene_graph,
            scene_description=scene_desc,
            safety_alerts=safety_alerts,
            safety_zones=safety_zones,
            action_suggestions=action_suggestions,
            change_alerts=change_alerts,
            floor_plane=floor,
            depth_available=depth_map is not None,
            roi=active_roi,
            governance_verdict=governance_verdict_dict,
        )

        self._last_frame = result
        return result

    def query(self, question: str) -> NLQueryResult:
        """Answer a natural-language question about the current scene (story 60).

        Parameters
        ----------
        question : str
            E.g. "is there a red cup on the table?"

        Returns
        -------
        NLQueryResult
        """
        if self._last_frame is None:
            return NLQueryResult(
                query=question,
                answer="No perception data available yet.",
                matched_objects=[],
                confidence=0.0,
            )
        return self.query_engine.query(
            question,
            self._last_frame.objects,
            self._last_frame.scene_graph,
        )

    @property
    def last_frame(self) -> Optional[PerceptionFrame]:
        return self._last_frame
