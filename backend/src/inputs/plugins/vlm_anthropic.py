"""Anthropic VLM input plugin — camera-based scene description via Claude vision."""

import logging
from enum import Enum
from typing import Optional

from pydantic import Field

from inputs.base import SensorConfig
from inputs.plugins.vlm_base import BaseVLMPlugin
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


class VLMAnthropic(BaseVLMPlugin):
    source_name = "VLMAnthropic"
    provider_name = "anthropic"

    def __init__(self, config: VLMAnthropicConfig):
        super().__init__(config)

    def _create_provider(self):
        return VLMAnthropicProvider(
            api_key=self.config.api_key,
            model=self.config.model,
            camera_index=self.config.camera_index,
        )

    def _handle_vlm_message(self, raw_message):
        """Handle Anthropic message response (not ChatCompletion)."""
        if not raw_message.content:
            logging.warning("VLMAnthropic response has empty content")
            return
        content = raw_message.content[0].text
        if content is not None:
            logging.info(f"VLMAnthropic received message: {content}")
            self.message_buffer.put(content)
