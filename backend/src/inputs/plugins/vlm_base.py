"""Base class for VLM input plugins — eliminates copy-paste across providers."""

import asyncio
import logging
import time
from queue import Empty, Queue
from typing import List, Optional

from openai.types.chat import ChatCompletion

from inputs.base import Message, SensorConfig
from inputs.base.loop import FuserInput
from providers.event_bus import EventBus, SceneDescriptionEvent
from providers.io_provider import IOProvider


class BaseVLMPlugin(FuserInput[SensorConfig, Optional[str]]):
    """Base VLM plugin with shared polling, buffering, and formatting logic.

    Subclasses must:
      - Set ``source_name`` and ``provider_name`` as class attributes.
      - Implement ``_create_provider()`` to return the started provider.
    """

    source_name: str = ""
    provider_name: str = ""

    def __init__(self, config: SensorConfig):
        super().__init__(config)
        self.io_provider = IOProvider()
        self.event_bus = EventBus()
        self.messages: List[Message] = []
        self.message_buffer: Queue[str] = Queue(maxsize=100)

        api_key = self.config.api_key
        if api_key is None or api_key == "":
            raise ValueError(f"config file missing api_key for {self.source_name}")

        self.vlm = self._create_provider()
        self.vlm.start()
        self.vlm.register_message_callback(self._handle_vlm_message)
        self.descriptor_for_LLM = "Vision"

    def _create_provider(self):
        """Create and return the VLM provider instance."""
        raise NotImplementedError

    def _handle_vlm_message(self, raw_message: ChatCompletion):
        """Handle OpenAI-compatible ChatCompletion response.

        Override for providers with a different response format (e.g. Anthropic).
        """
        if not raw_message.choices:
            logging.warning(f"{self.source_name} response has empty choices")
            return
        content = raw_message.choices[0].message.content
        if content is not None:
            logging.info(f"{self.source_name} received message: {content}")
            self.message_buffer.put(content)

    async def _poll(self) -> Optional[str]:
        await asyncio.sleep(0.5)
        try:
            message = self.message_buffer.get_nowait()
            return message
        except Empty:
            return None

    async def _raw_to_text(self, raw_input: Optional[str]) -> Optional[Message]:
        if raw_input is None:
            return None
        return Message(timestamp=time.time(), message=raw_input)

    async def raw_to_text(self, raw_input: Optional[str]):
        if raw_input is None:
            return
        pending_message = await self._raw_to_text(raw_input)
        if pending_message is not None:
            self.messages.append(pending_message)
            self.event_bus.publish(
                SceneDescriptionEvent(
                    source=self.source_name,
                    description=pending_message.message,
                    provider=self.provider_name,
                )
            )

    def formatted_latest_buffer(self) -> Optional[str]:
        if len(self.messages) == 0:
            return None
        latest_message = self.messages[-1]
        result = f"\nINPUT: {self.descriptor_for_LLM}\n// START\n{latest_message.message}\n// END\n"
        self.io_provider.add_input(
            self.__class__.__name__, latest_message.message, latest_message.timestamp
        )
        self.messages = []
        return result

    def stop(self):
        if self.vlm:
            self.vlm.stop()
