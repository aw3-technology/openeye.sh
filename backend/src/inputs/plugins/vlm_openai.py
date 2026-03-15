"""OpenAI VLM input plugin — camera-based scene description via OpenAI."""

from enum import Enum
from typing import Optional

from pydantic import Field

from inputs.base import SensorConfig
from inputs.plugins.vlm_base import BaseVLMPlugin
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


class VLMOpenAI(BaseVLMPlugin):
    source_name = "VLMOpenAI"
    provider_name = "openai"

    def __init__(self, config: VLMOpenAIConfig):
        super().__init__(config)

    def _create_provider(self):
        return VLMOpenAIProvider(
            base_url=self.config.base_url,
            api_key=self.config.api_key,
            model=self.config.model,
            camera_index=self.config.camera_index,
        )
