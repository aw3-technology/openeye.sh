"""OpenRouter VLM input plugin — camera-based scene description via OpenRouter."""

import asyncio
import logging
import time
from queue import Empty, Queue
from typing import List, Optional

from openai.types.chat import ChatCompletion
from pydantic import Field

from inputs.base import Message, SensorConfig
from inputs.base.loop import FuserInput
from providers.event_bus import EventBus, SceneDescriptionEvent
from providers.io_provider import IOProvider
from providers.vlm_openrouter_provider import VLMOpenRouterProvider


class VLMOpenRouterConfig(SensorConfig):
    api_key: Optional[str] = Field(default=None, description="OpenRouter API Key")
    base_url: str = Field(
        default="https://openrouter.ai/api/v1",
        description="OpenRouter Base URL",
    )
    model: str = Field(
        default="qwen/qwen3-vl-235b:free",
        description="OpenRouter vision model to use",
    )
    camera_index: int = Field(default=0, description="Camera Index")
    site_url: str = Field(
        default="https://perceptify.dev",
        description="Site URL for OpenRouter HTTP-Referer header",
    )
    site_name: str = Field(
        default="OpenEye",
        description="Site name for OpenRouter X-Title header",
    )


class VLMOpenRouter(FuserInput[VLMOpenRouterConfig, Optional[str]]):
    def __init__(self, config: VLMOpenRouterConfig):
        super().__init__(config)
        self.io_provider = IOProvider()
        self.event_bus = EventBus()
        self.messages: List[Message] = []
        self.message_buffer: Queue[str] = Queue(maxsize=100)
        api_key = self.config.api_key
        if api_key is None or api_key == "":
            raise ValueError("config file missing api_key for OpenRouter VLM")
        base_url = self.config.base_url
        model = self.config.model
        camera_index = self.config.camera_index
        self.vlm: VLMOpenRouterProvider = VLMOpenRouterProvider(
            base_url=base_url,
            api_key=api_key,
            model=model,
            camera_index=camera_index,
            site_url=self.config.site_url,
            site_name=self.config.site_name,
        )
        self.vlm.start()
        self.vlm.register_message_callback(self._handle_vlm_message)
        self.descriptor_for_LLM = "Vision"

    def _handle_vlm_message(self, raw_message: ChatCompletion):
        logging.info(f"VLM OpenRouter received message: {raw_message}")
        if not raw_message.choices:
            logging.warning("VLM OpenRouter response has empty choices")
            return
        content = raw_message.choices[0].message.content
        if content is not None:
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
                    source="VLMOpenRouter",
                    description=pending_message.message,
                    provider="openrouter",
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
