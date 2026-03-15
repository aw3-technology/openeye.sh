"""Safety search action — queries safety information for detected objects."""

from dataclasses import dataclass

from actions.base import Interface


@dataclass
class SafetySearchInput:
    """Query describing the object or scene to search safety info for."""

    query: str


@dataclass
class SafetySearchOutput:
    """Safety information returned from the search."""

    safety_info: str = ""


@dataclass
class SafetySearchInterface(Interface[SafetySearchInput, SafetySearchOutput]):
    """Search for safety hazards and risks related to detected objects or scenes."""

    input: SafetySearchInput = None  # type: ignore
    output: SafetySearchOutput = None  # type: ignore
