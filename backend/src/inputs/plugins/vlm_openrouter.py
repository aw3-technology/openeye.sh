"""OpenRouter VLM input plugin — camera-based scene description via OpenRouter."""

from typing import Optional

from pydantic import Field

from inputs.base import SensorConfig
from inputs.plugins.vlm_base import BaseVLMPlugin
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


class VLMOpenRouter(BaseVLMPlugin):
    source_name = "VLMOpenRouter"
    provider_name = "openrouter"

    def __init__(self, config: VLMOpenRouterConfig):
        super().__init__(config)

    def _create_provider(self):
        return VLMOpenRouterProvider(
            base_url=self.config.base_url,
            api_key=self.config.api_key,
            model=self.config.model,
            camera_index=self.config.camera_index,
            site_url=self.config.site_url,
            site_name=self.config.site_name,
        )
