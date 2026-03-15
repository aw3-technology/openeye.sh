"""Robot control action — sends halt/resume/slow commands to robot."""

from dataclasses import dataclass
from enum import Enum

from actions.base import Interface


class RobotCommand(str, Enum):
    halt = "halt"
    resume = "resume"
    slow = "slow"


@dataclass
class RobotControlInput:
    """Command to send to the robot controller."""

    command: RobotCommand
    reason: str = ""


@dataclass
class RobotControlOutput:
    """Result of the robot control command."""

    executed: bool = True


@dataclass
class RobotControlInterface(Interface[RobotControlInput, RobotControlOutput]):
    """Control robot movement: halt, resume, or slow based on safety assessment."""

    input: RobotControlInput = None  # type: ignore
    output: RobotControlOutput = None  # type: ignore
