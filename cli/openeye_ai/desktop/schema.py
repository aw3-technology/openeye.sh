"""Pydantic models for desktop perception results."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

UIElementType = Literal[
    "button",
    "input",
    "menu",
    "menu_item",
    "tab",
    "link",
    "checkbox",
    "radio",
    "dropdown",
    "icon",
    "text",
    "image",
    "window",
    "toolbar",
    "scrollbar",
    "dialog",
    "tooltip",
    "other",
]

UIElementState = Literal[
    "enabled",
    "disabled",
    "focused",
    "selected",
    "hovered",
    "checked",
    "unchecked",
    "expanded",
    "collapsed",
]

class UIBBoxPct(BaseModel):
    """Bounding box as screen percentage (0-1)."""

    x: float = Field(ge=0, le=1, description="Left edge (0-1)")
    y: float = Field(ge=0, le=1, description="Top edge (0-1)")
    w: float = Field(ge=0, le=1, description="Width (0-1)")
    h: float = Field(ge=0, le=1, description="Height (0-1)")

class UIElement(BaseModel):
    """A detected UI element on screen."""

    type: UIElementType
    text: str = ""
    bbox_pct: UIBBoxPct
    state: UIElementState = "enabled"
    confidence: float = Field(default=0.0, ge=0, le=1)

class ActiveWindow(BaseModel):
    """Information about the foreground window."""

    title: str = ""
    application: str = ""

class TextRegion(BaseModel):
    """A region of readable text on screen."""

    region_name: str = ""
    text: str = ""
    bbox_pct: UIBBoxPct | None = None

class DesktopPerceptionResult(BaseModel):
    """Full output from desktop VLM analysis."""

    active_window: ActiveWindow = Field(default_factory=ActiveWindow)
    ui_elements: list[UIElement] = Field(default_factory=list)
    text_regions: list[TextRegion] = Field(default_factory=list)
    focused_element: UIElement | None = None
    layout_description: str = ""
    detection_ms: float = 0.0
    vlm_ms: float = 0.0
    total_ms: float = 0.0

class FindElementResult(BaseModel):
    """Result of a targeted element search."""

    found: bool = False
    element: UIElement | None = None
    alternatives: list[UIElement] = Field(default_factory=list)
    query: str = ""

class ReadTextResult(BaseModel):
    """Result of OCR/text extraction."""

    text: str = ""
    regions: list[TextRegion] = Field(default_factory=list)
