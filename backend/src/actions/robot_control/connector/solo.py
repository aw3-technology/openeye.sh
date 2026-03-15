"""Solo connector — sends robot control commands via solo CLI subprocess."""

import logging
import subprocess

from actions.base import ActionConfig, ActionConnector
from actions.robot_control.interface import RobotCommand, RobotControlInput


class SoloConnector(ActionConnector[ActionConfig, RobotControlInput]):
    """Connector that controls robot via solo CLI commands."""

    async def connect(self, input_interface: RobotControlInput) -> None:
        command = input_interface.command
        reason = input_interface.reason
        logging.info(f"[RobotControl] {command.value}: {reason}")

        try:
            if command == RobotCommand.halt:
                subprocess.run(
                    ["solo", "motor", "stop"],
                    capture_output=True,
                    timeout=5,
                )
            elif command == RobotCommand.resume:
                subprocess.run(
                    ["solo", "motor", "start"],
                    capture_output=True,
                    timeout=5,
                )
            elif command == RobotCommand.slow:
                subprocess.run(
                    ["solo", "motor", "speed", "50"],
                    capture_output=True,
                    timeout=5,
                )
        except FileNotFoundError:
            logging.warning("[RobotControl] solo CLI not found — command logged only")
        except subprocess.TimeoutExpired:
            logging.error("[RobotControl] solo CLI timed out")
        except Exception as e:
            logging.error(f"[RobotControl] Error: {e}")
