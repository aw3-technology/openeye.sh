"""Anthropic VLM input plugin — camera-based scene description via Claude vision."""

import asyncio
import logging
import time
from enum import Enum
from queue import Empty, Queue
from typing import List, Optional

from pydantic import Field

from inputs.base import Message, SensorConfig
from inputs.base.loop import FuserInput
from providers.event_bus import EventBus, SceneDescriptionEvent
from providers.io_provider import IOProvider
from providers.vlm_anthropic_provider import VLMAnthropicProvider


class AnthropicVLMModel(str, Enum):
    CLAUDE_SONNET_4_6 = "claude-sonnet-4-6"
    CLAUDE_SONNET_4_5 = "claude-sonnet-4-5-20251022"


class VLMAnthropicConfig(SensorConfig):
    api_key: Optional[str] = Field(default=None, description="Anthropic API Key")
    model: str = Field(
        default=AnthropicVLMModel.CLAUDE_SONNET_4_6,
        description="Anthropic VLM model to use",
    )
    camera_index: int = Field(default=0, description="Camera Index")


class VLMAnthropic(FuserInput[VLMAnthropicConfig, Optional[str]]):
    def __init__(self, config: VLMAnthropicConfig):
        super().__init__(config)
        self.io_provider = IOProvider()
        self.event_bus = EventBus()
        self.messages: List[Message] = []
        self.message_buffer: Queue[str] = Queue(maxsize=100)
        api_key = self.config.api_key
        if api_key is None or api_key == "":
            raise ValueError("config file missing api_key for Anthropic VLM")
        model = self.config.model
        camera_index = self.config.camera_index
        self.vlm: VLMAnthropicProvider = VLMAnthropicProvider(
            api_key=api_key,
            model=model,
            camera_index=camera_index,
        )
        self.vlm.start()
        self.vlm.register_message_callback(self._handle_vlm_message)
        self.descriptor_for_LLM = "Vision"

    def _handle_vlm_message(self, raw_message):
        """Handle Anthropic message response (not ChatCompletion)."""
        if not raw_message.content:
            logging.warning("VLM Anthropic response has empty content")
            return
        content = raw_message.content[0].text
        if content is not None:
            logging.info(f"VLM Anthropic received message: {content}")
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
                    source="VLMAnthropic",
                    description=pending_message.message,
                    provider="anthropic",
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
