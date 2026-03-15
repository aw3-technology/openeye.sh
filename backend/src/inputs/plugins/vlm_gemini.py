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
from providers.vlm_gemini_provider import VLMGeminiProvider


class GeminiVLMModel(str, Enum):
    GEMINI_2_5_FLASH = "gemini-2.5-flash"
    GEMINI_3_PRO_PREVIEW = "gemini-3-pro-preview"


class VLMGeminiConfig(SensorConfig):
    api_key: Optional[str] = Field(default=None, description="API Key")
    base_url: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta/openai",
        description="Base URL for the Gemini service",
    )
    model: str = Field(
        default=GeminiVLMModel.GEMINI_2_5_FLASH,
        description="Gemini VLM model to use",
    )
    camera_index: int = Field(default=0, description="Index of the camera device")


class VLMGemini(FuserInput[VLMGeminiConfig, Optional[str]]):
    def __init__(self, config: VLMGeminiConfig):
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
        self.vlm: VLMGeminiProvider = VLMGeminiProvider(
            base_url=base_url,
            api_key=api_key,
            model=model,
            camera_index=camera_index,
        )
        self.vlm.start()
        self.vlm.register_message_callback(self._handle_vlm_message)
        self.descriptor_for_LLM = "Vision"

    def _handle_vlm_message(self, raw_message: ChatCompletion):
        if not raw_message.choices:
            logging.warning("VLM Gemini response has empty choices")
            return
        content = raw_message.choices[0].message.content
        if content is not None:
            logging.info(f"VLM Gemini received message: {content}")
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
                    source="VLMGemini",
                    description=pending_message.message,
                    provider="gemini",
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
