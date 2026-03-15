"""Nebius Token Factory LLM plugin — OpenAI-compatible endpoint."""

import typing as T
from enum import Enum

import openai
from pydantic import Field

from llm import LLMConfig
from llm.plugins.openai_compatible_base import BaseOpenAICompatibleLLM
from providers.llm_history_manager import LLMHistoryManager

R = T.TypeVar("R")


class NebiusModel(str, Enum):
    # Vision-Language Models
    QWEN3_VL_72B = "Qwen/Qwen3-VL-72B"
    KIMI_K2_5 = "moonshot-ai/Kimi-K2.5"
    # LLM Reasoning
    LLAMA_3_3_70B = "meta-llama/Llama-3.3-70B-Instruct"
    QWEN3_235B = "Qwen/Qwen3-235B-A22B-Instruct-2507"
    QWEN3_NEXT_80B = "Qwen/Qwen3-Next-80B-A14B-Instruct"
    DEEPSEEK_V3_2 = "deepseek-ai/DeepSeek-V3-0324"
    GPT_OSS_120B = "marcusaurelius/GPT-OSS-120B"
    # Safety & Moderation
    LLAMA_GUARD_3_8B = "meta-llama/Llama-Guard-3-8B"
    # Embeddings
    QWEN3_EMBEDDING_8B = "Qwen/Qwen3-Embedding-8B"


class NebiusConfig(LLMConfig):
    base_url: T.Optional[str] = Field(
        default="https://api.tokenfactory.nebius.com/v1/",
        description="Base URL for the Nebius Token Factory API endpoint",
    )
    model: T.Optional[T.Union[NebiusModel, str]] = Field(
        default=NebiusModel.QWEN3_235B,
        description="Nebius model to use",
    )


class NebiusLLM(BaseOpenAICompatibleLLM[R]):
    _log_prefix = "Nebius"
    _default_model = NebiusModel.QWEN3_235B

    def __init__(
        self,
        config: NebiusConfig,
        available_actions: T.Optional[T.List] = None,
    ):
        super().__init__(config, available_actions)

        if not config.api_key:
            raise ValueError("config file missing api_key for Nebius")
        if not config.model:
            self._config.model = NebiusModel.QWEN3_235B

        self._client = openai.AsyncClient(
            base_url=config.base_url or "https://api.tokenfactory.nebius.com/v1/",
            api_key=config.api_key,
        )
        self.history_manager = LLMHistoryManager(self._config, self._client)
