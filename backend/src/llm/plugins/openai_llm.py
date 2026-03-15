"""OpenAI LLM plugin — GPT models for reasoning and tool use."""

import typing as T
from enum import Enum

import openai
from pydantic import Field

from llm import LLMConfig
from llm.plugins.openai_compatible_base import BaseOpenAICompatibleLLM
from providers.llm_history_manager import LLMHistoryManager

R = T.TypeVar("R")


class OpenAIModel(str, Enum):
    GPT_4_O = "gpt-4o"
    GPT_4_O_MINI = "gpt-4o-mini"
    GPT_4_1 = "gpt-4.1"
    GPT_4_1_MINI = "gpt-4.1-mini"
    GPT_4_1_NANO = "gpt-4.1-nano"
    GPT_5 = "gpt-5"
    GPT_5_2 = "gpt-5.2"


class OpenAIConfig(LLMConfig):
    base_url: T.Optional[str] = Field(
        default="https://api.openai.com/v1",
        description="Base URL for the OpenAI API endpoint",
    )
    model: T.Optional[T.Union[OpenAIModel, str]] = Field(
        default=OpenAIModel.GPT_4_O_MINI,
        description="OpenAI model to use",
    )


class OpenAILLM(BaseOpenAICompatibleLLM[R]):
    _log_prefix = "OpenAI"
    _default_model = OpenAIModel.GPT_4_O_MINI

    def __init__(
        self,
        config: OpenAIConfig,
        available_actions: T.Optional[T.List] = None,
    ):
        super().__init__(config, available_actions)

        if not config.api_key:
            raise ValueError("config file missing api_key")
        if not config.model:
            self._config.model = OpenAIModel.GPT_4_O_MINI

        self._client = openai.AsyncClient(
            base_url=config.base_url or "https://api.openai.com/v1",
            api_key=config.api_key,
        )
        self.history_manager = LLMHistoryManager(self._config, self._client)
