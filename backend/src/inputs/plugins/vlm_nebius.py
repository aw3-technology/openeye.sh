"""Nebius VLM input plugin — camera-based scene description via Nebius Token Factory."""

from typing import Optional

from pydantic import Field

from inputs.base import SensorConfig
from inputs.plugins.vlm_base import BaseVLMPlugin
from providers.vlm_nebius_provider import VLMNebiusProvider


class VLMNebiusConfig(SensorConfig):
    api_key: Optional[str] = Field(default=None, description="Nebius API Key")
    base_url: str = Field(
        default="https://api.tokenfactory.nebius.com/v1/",
        description="Nebius Token Factory Base URL",
    )
    model: str = Field(
        default="Qwen/Qwen3-VL-72B",
        description="Nebius vision model to use",
    )
    camera_index: int = Field(default=0, description="Camera Index")


class VLMNebius(BaseVLMPlugin):
    source_name = "VLMNebius"
    provider_name = "nebius"

    def __init__(self, config: VLMNebiusConfig):
        super().__init__(config)

    def _create_provider(self):
        return VLMNebiusProvider(
            base_url=self.config.base_url,
            api_key=self.config.api_key,
            model=self.config.model,
            camera_index=self.config.camera_index,
        )
