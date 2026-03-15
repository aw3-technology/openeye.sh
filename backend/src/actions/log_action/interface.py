"""Minimal logging action for testing the action framework."""

from dataclasses import dataclass
from enum import Enum

from actions.base import Interface


class LogLevel(str, Enum):
    info = "info"
    debug = "debug"
    warning = "warning"


@dataclass
class LogInput:
    """The text message to log."""

    message: str
    level: LogLevel = LogLevel.info


@dataclass
class LogOutput:
    logged: bool = True


@dataclass
class LogInterface(Interface[LogInput, LogOutput]):
    """Log a message to the console."""

    input: LogInput = None  # type: ignore
    output: LogOutput = None  # type: ignore
