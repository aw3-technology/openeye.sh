"""Anthropic LLM plugin — Claude models for reasoning and tool use."""

import json
import logging
import time
import typing as T
from enum import Enum

from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field

from llm import LLM, LLMConfig
from llm.function_schemas import convert_function_calls_to_actions
from llm.output_model import CortexOutputModel
from providers.llm_history_manager import LLMHistoryManager

R = T.TypeVar("R", bound=BaseModel)


class AnthropicModel(str, Enum):
    CLAUDE_SONNET_4_6 = "claude-sonnet-4-6"
    CLAUDE_SONNET_4_5 = "claude-sonnet-4-5-20251022"
    CLAUDE_OPUS_4 = "claude-opus-4-0-20250514"


class AnthropicConfig(LLMConfig):
    base_url: T.Optional[str] = Field(
        default=None,
        description="Base URL for the Anthropic API endpoint (optional)",
    )
    model: T.Optional[T.Union[AnthropicModel, str]] = Field(
        default=AnthropicModel.CLAUDE_SONNET_4_6,
        description="Anthropic model to use",
    )
    history_length: T.Optional[int] = Field(
        default=0,
        description="Number of past interactions to keep (0 disables OpenAI-coupled history)",
    )


class AnthropicLLM(LLM[R]):
    def __init__(
        self,
        config: AnthropicConfig,
        available_actions: T.Optional[T.List] = None,
    ):
        super().__init__(config, available_actions)

        if not config.api_key:
            raise ValueError("config file missing api_key")
        if not config.model:
            self._config.model = AnthropicModel.CLAUDE_SONNET_4_6

        self._anthropic_client = AsyncAnthropic(
            api_key=config.api_key,
            base_url=config.base_url,
        )

        # history_length=0 means the decorator short-circuits before any
        # OpenAI call, so no real client is needed.
        self.history_manager = LLMHistoryManager(self._config, None)  # type: ignore[arg-type]

        # Convert OpenAI-style function schemas to Anthropic tool format
        self._anthropic_tools = self._convert_tools(self.function_schemas)

    @staticmethod
    def _convert_tools(openai_schemas: list) -> list:
        """Convert OpenAI function schemas to Anthropic tool format."""
        tools = []
        for schema in openai_schemas:
            func = schema.get("function", {})
            tools.append({
                "name": func.get("name", ""),
                "description": func.get("description", ""),
                "input_schema": func.get("parameters", {}),
            })
        return tools

    @LLMHistoryManager.update_history()
    async def ask(
        self, prompt: str, messages: T.Optional[T.List[T.Dict[str, str]]] = None
    ) -> T.Optional[R]:
        if messages is None:
            messages = []
        try:
            logging.info(f"Anthropic input: {prompt}")

            self.io_provider.llm_start_time = time.time()
            self.io_provider.llm_prompt = prompt

            anthropic_messages = [
                {"role": msg.get("role", "user"), "content": msg.get("content", "")}
                for msg in messages
            ]
            anthropic_messages.append({"role": "user", "content": prompt})

            kwargs: T.Dict[str, T.Any] = {
                "model": self._config.model or AnthropicModel.CLAUDE_SONNET_4_6,
                "max_tokens": 1024,
                "messages": anthropic_messages,
            }
            if self._anthropic_tools:
                kwargs["tools"] = self._anthropic_tools

            response = await self._anthropic_client.messages.create(**kwargs)

            self.io_provider.llm_end_time = time.time()

            # Extract tool use blocks from response
            tool_use_blocks = [
                block for block in response.content
                if block.type == "tool_use"
            ]

            if tool_use_blocks:
                logging.info(f"Received {len(tool_use_blocks)} function calls")

                function_call_data = [
                    {
                        "function": {
                            "name": block.name,
                            "arguments": json.dumps(block.input),
                        }
                    }
                    for block in tool_use_blocks
                ]

                actions = convert_function_calls_to_actions(function_call_data)
                result = CortexOutputModel(actions=actions)
                return T.cast(R, result)

            return None
        except Exception as e:
            logging.error(f"Anthropic API error: {e}")
            return None
