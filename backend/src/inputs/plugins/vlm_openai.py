import asyncio
import logging
import time
from enum import Enum
from queue import Empty, Queue
from typing import List, Optional

from openai.types.chat import ChatCompletion
from pydantic import Field

from inputs.base import Message, SensorConfig
from inputs.base.loop import FuserInput
from providers.event_bus import EventBus, SceneDescriptionEvent
from providers.io_provider import IOProvider
from providers.vlm_openai_provider import VLMOpenAIProvider


class OpenAIVLMModel(str, Enum):
    GPT_4O = "gpt-4o"
    GPT_5 = "gpt-5"
    GPT_5_2 = "gpt-5.2"


class VLMOpenAIConfig(SensorConfig):
    api_key: Optional[str] = Field(default=None, description="API Key")
    base_url: str = Field(default="https://api.openai.com/v1", description="Base URL")
    model: str = Field(
        default=OpenAIVLMModel.GPT_4O,
        description="OpenAI VLM model to use",
    )
    camera_index: int = Field(default=0, description="Camera Index")


class VLMOpenAI(FuserInput[VLMOpenAIConfig, Optional[str]]):
    def __init__(self, config: VLMOpenAIConfig):
        super().__init__(config)
        self.io_provider = IOProvider()
        self.event_bus = EventBus()
        self.messages: List[Message] = []
        self.message_buffer: Queue[str] = Queue(maxsize=100)
        api_key = self.config.api_key
        if api_key is None or api_key == "":
            raise ValueError("config file missing api_key")
        base_url = self.config.base_url
        camera_index = self.config.camera_index
        model = self.config.model
        self.vlm: VLMOpenAIProvider = VLMOpenAIProvider(
            base_url=base_url,
            api_key=api_key,
            model=model,
            camera_index=camera_index,
        )
        self.vlm.start()
        self.vlm.register_message_callback(self._handle_vlm_message)
        self.descriptor_for_LLM = "Vision"

    def _handle_vlm_message(self, raw_message: ChatCompletion):
        logging.info(f"VLM OpenAI received message: {raw_message}")
        if not raw_message.choices:
            logging.warning("VLM OpenAI response has empty choices")
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
                    source="VLMOpenAI",
                    description=pending_message.message,
                    provider="openai",
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
