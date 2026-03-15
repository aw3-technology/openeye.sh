"""Pydantic models for unified JSON output."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class BBox(BaseModel):
    x: float = Field(description="Left edge, normalized 0-1")
    y: float = Field(description="Top edge, normalized 0-1")
    w: float = Field(description="Width, normalized 0-1")
    h: float = Field(description="Height, normalized 0-1")


class DetectedObject(BaseModel):
    label: str
    confidence: float
    bbox: BBox


class ImageInfo(BaseModel):
    width: int
    height: int
    source: str


class SegmentationMask(BaseModel):
    mask: str = Field(description="Base64-encoded mask PNG")
    area: int = Field(description="Mask area in pixels")
    bbox: BBox
    stability_score: float = Field(default=0.0, description="Mask stability score")


class PredictionResult(BaseModel):
    model: str
    task: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    image: ImageInfo
    objects: list[DetectedObject] = Field(default_factory=list)
    depth_map: Optional[str] = Field(
        default=None, description="Base64-encoded depth map PNG, if applicable"
    )
    segmentation_masks: Optional[list[SegmentationMask]] = Field(
        default=None, description="Segmentation masks from SAM2 or similar"
    )
    vla_action: Optional[list[float]] = Field(
        default=None, description="VLA action vector for robotic control"
    )
    inference_ms: float


# ── Agentic pipeline models ─────────────────────────────────────────


class Observation(BaseModel):
    """A memory-worthy snapshot from one perception tick."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    tick: int
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    detections: list[DetectedObject] = Field(default_factory=list)
    scene_summary: str = ""
    change_description: str = ""
    significance: float = Field(default=0.0, ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list)


class AgentReasoning(BaseModel):
    """One reasoning step produced by the LLM."""

    observation_summary: str = ""
    memory_context: str = ""
    chain_of_thought: str = ""
    current_plan: list[str] = Field(default_factory=list)
    decided_action: str = ""
    plan_changed: bool = False


class AgentTickEvent(BaseModel):
    """Complete tick output streamed to clients."""

    tick: int
    phase: str = Field(description="perceive | recall | reason | act")
    prediction: Optional[PredictionResult] = None
    observation: Optional[Observation] = None
    reasoning: Optional[AgentReasoning] = None
    action_taken: str = ""
    memory_recalled: list[Observation] = Field(default_factory=list)
    current_plan: list[str] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RecallQuery(BaseModel):
    """Query for memory recall."""

    query: str = ""
    time_range: Optional[str] = None  # e.g. "last_1h", "last_24h"
    significance_min: float = 0.0
    limit: int = 10


class RecallResult(BaseModel):
    """Response from memory recall."""

    observations: list[Observation] = Field(default_factory=list)
    query: str = ""
    total_matches: int = 0
