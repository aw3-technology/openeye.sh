"""OpenRouter LLM plugin — OpenAI-compatible with fallback support."""

import logging
import time
import typing as T
from enum import Enum

import openai
from pydantic import Field

from llm import LLMConfig
from llm.plugins.openai_compatible_base import BaseOpenAICompatibleLLM
from providers.llm_history_manager import LLMHistoryManager

R = T.TypeVar("R")


class OpenRouterModel(str, Enum):
    QWEN3_VL_235B_FREE = "qwen/qwen3-vl-235b:free"
    NEMOTRON_NANO_12B_VL_FREE = "nvidia/nemotron-nano-12b-vl:free"
    GEMMA_3_27B_IT_FREE = "google/gemma-3-27b-it:free"
    # Vision/Multimodal
    QWEN3_5_9B = "qwen/qwen3.5-9b"
    HEALER_ALPHA = "openrouter/healer-alpha"
    SEED_2_LITE = "bytedance-seed/seed-2.0-lite"
    GPT_5_4 = "openai/gpt-5.4"
    # Agentic Reasoning
    GLM_5_TURBO = "z-ai/glm-5-turbo"
    HUNTER_ALPHA = "openrouter/hunter-alpha"
    NEMOTRON_3_SUPER_FREE = "nvidia/nemotron-3-super:free"


class OpenRouterConfig(LLMConfig):
    base_url: T.Optional[str] = Field(
        default="https://openrouter.ai/api/v1",
        description="Base URL for the OpenRouter API endpoint",
    )
    model: T.Optional[T.Union[OpenRouterModel, str]] = Field(
        default=OpenRouterModel.QWEN3_VL_235B_FREE,
        description="OpenRouter model to use",
    )
    fallback_model: T.Optional[str] = Field(
        default=OpenRouterModel.GEMMA_3_27B_IT_FREE,
        description="Fallback model if the primary model fails",
    )
    site_url: str = Field(
        default="https://perceptify.dev",
        description="Site URL for OpenRouter HTTP-Referer header",
    )
    site_name: str = Field(
        default="OpenEye",
        description="Site name for OpenRouter X-Title header",
    )


class OpenRouterLLM(BaseOpenAICompatibleLLM[R]):
    _log_prefix = "OpenRouter"
    _default_model = OpenRouterModel.QWEN3_VL_235B_FREE

    def __init__(
        self,
        config: OpenRouterConfig,
        available_actions: T.Optional[T.List] = None,
    ):
        super().__init__(config, available_actions)

        if not config.api_key:
            raise ValueError("config file missing api_key for OpenRouter")
        if not config.model:
            self._config.model = OpenRouterModel.QWEN3_VL_235B_FREE

        self._client = openai.AsyncClient(
            base_url=config.base_url or "https://openrouter.ai/api/v1",
            api_key=config.api_key,
            default_headers={
                "HTTP-Referer": config.site_url,
                "X-Title": config.site_name,
            },
        )
        self.history_manager = LLMHistoryManager(self._config, self._client)

    async def _call_model(
        self, model: str, formatted_messages: list
    ) -> T.Optional[R]:
        response = await self._client.chat.completions.create(
            model=model,
            messages=T.cast(T.Any, formatted_messages),
            tools=T.cast(T.Any, self.function_schemas),
            tool_choice="auto",
            timeout=self._config.timeout,
        )
        return self._parse_response(response)

    @LLMHistoryManager.update_history()
    async def ask(
        self, prompt: str, messages: T.Optional[T.List[T.Dict[str, str]]] = None
    ) -> T.Optional[R]:
        if messages is None:
            messages = []
        try:
            logging.info(f"OpenRouter input: {prompt}")

            self.io_provider.llm_start_time = time.time()
            self.io_provider.llm_prompt = prompt

            formatted_messages = [
                {"role": msg.get("role", "user"), "content": msg.get("content", "")}
                for msg in messages
            ]
            formatted_messages.append({"role": "user", "content": prompt})

            primary_model = self._config.model or OpenRouterModel.QWEN3_VL_235B_FREE
            try:
                return await self._call_model(primary_model, formatted_messages)
            except Exception as e:
                fallback = self._config.fallback_model
                if fallback:
                    logging.warning(
                        f"OpenRouter primary model ({primary_model}) failed: {e}. "
                        f"Falling back to {fallback}"
                    )
                    return await self._call_model(fallback, formatted_messages)
                raise

        except Exception as e:
            logging.error(f"OpenRouter API error: {e}")
            return None
