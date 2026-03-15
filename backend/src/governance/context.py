"""Governance context types — union of robotics and desktop agent domains."""

from __future__ import annotations

from typing import Any, Optional, Union

from pydantic import BaseModel, Field

from perception.models import (
    ActionSuggestion,
    DetectedObject3D,
    SafetyAlert,
    SafetyZone,
    SceneGraphData,
)


class ScreenRegion(BaseModel):
    """A rectangular region of a screen (normalised 0-1)."""

    x1: float = Field(ge=0, le=1)
    y1: float = Field(ge=0, le=1)
    x2: float = Field(ge=0, le=1)
    y2: float = Field(ge=0, le=1)
    label: str = ""


class UIElement(BaseModel):
    """A UI element detected or being interacted with."""

    element_type: str = ""  # button, input, link, etc.
    text: str = ""
    region: Optional[ScreenRegion] = None
    app_name: str = ""
    url: str = ""
    attributes: dict[str, Any] = Field(default_factory=dict)


class RoboticsContext(BaseModel):
    """Context for robotics governance evaluation."""

    objects: list[DetectedObject3D] = Field(default_factory=list)
    scene_graph: SceneGraphData = Field(default_factory=SceneGraphData)
    safety_alerts: list[SafetyAlert] = Field(default_factory=list)
    safety_zones: list[SafetyZone] = Field(default_factory=list)
    action_suggestions: list[ActionSuggestion] = Field(default_factory=list)
    robot_position: Optional[tuple[float, float, float]] = None
    robot_velocity: Optional[float] = None
    current_goal: str = ""


class DesktopContext(BaseModel):
    """Context for desktop agent governance evaluation."""

    screen_text: str = ""
    ui_elements: list[UIElement] = Field(default_factory=list)
    active_app: str = ""
    active_url: str = ""
    pending_action: Optional[str] = None
    pending_target: Optional[UIElement] = None
    action_history: list[dict[str, Any]] = Field(default_factory=list)
    clipboard_text: str = ""


class GovernanceContext(BaseModel):
    """Union context for governance evaluation — holds whichever domain is active."""

    frame_id: int = 0
    timestamp: float = 0.0
    robotics: Optional[RoboticsContext] = None
    desktop: Optional[DesktopContext] = None

    @property
    def is_robotics(self) -> bool:
        return self.robotics is not None

    @property
    def is_desktop(self) -> bool:
        return self.desktop is not None

    @classmethod
    def from_robotics(
        cls,
        frame_id: int,
        timestamp: float,
        **kwargs: Any,
    ) -> GovernanceContext:
        return cls(
            frame_id=frame_id,
            timestamp=timestamp,
            robotics=RoboticsContext(**kwargs),
        )

    @classmethod
    def from_desktop(
        cls,
        frame_id: int,
        timestamp: float,
        **kwargs: Any,
    ) -> GovernanceContext:
        return cls(
            frame_id=frame_id,
            timestamp=timestamp,
            desktop=DesktopContext(**kwargs),
        )
