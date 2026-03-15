"""Gemini VLM input plugin — camera-based scene description via Google Gemini."""

from enum import Enum
from typing import Optional

from pydantic import Field

from inputs.base import SensorConfig
from inputs.plugins.vlm_base import BaseVLMPlugin
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


class VLMGemini(BaseVLMPlugin):
    source_name = "VLMGemini"
    provider_name = "gemini"

    def __init__(self, config: VLMGeminiConfig):
        super().__init__(config)

    def _create_provider(self):
        return VLMGeminiProvider(
            base_url=self.config.base_url,
            api_key=self.config.api_key,
            model=self.config.model,
            camera_index=self.config.camera_index,
        )
