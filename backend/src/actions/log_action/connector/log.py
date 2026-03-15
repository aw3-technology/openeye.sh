"""Log connector — prints action input to the console."""

import logging

from actions.base import ActionConfig, ActionConnector
from actions.log_action.interface import LogInput


class LogConnector(ActionConnector[ActionConfig, LogInput]):
    """Connector that logs the action input."""

    async def connect(self, input_interface: LogInput) -> None:
        logging.info(f"[LogAction] {input_interface.message}")
