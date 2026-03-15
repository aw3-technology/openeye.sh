"""Tavily connector — searches for safety information using Tavily API."""

import logging

from actions.base import ActionConfig, ActionConnector
from actions.safety_search.interface import SafetySearchInput
from providers.tavily_provider import TavilyProvider


class TavilyConnector(ActionConnector[ActionConfig, SafetySearchInput]):
    """Connector that searches for safety information via Tavily."""

    def __init__(self, config: ActionConfig):
        super().__init__(config)
        self._provider = TavilyProvider()

    async def connect(self, input_interface: SafetySearchInput) -> None:
        logging.info(f"[SafetySearch] Searching: {input_interface.query}")
        result = self._provider.search_safety_info(input_interface.query)
        logging.info(f"[SafetySearch] Result: {result[:200]}")
