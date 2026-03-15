import logging
import time
import typing as T
from enum import Enum

import openai
from pydantic import BaseModel, Field

from llm import LLM, LLMConfig
from llm.function_schemas import convert_function_calls_to_actions
from llm.output_model import CortexOutputModel
from providers.llm_history_manager import LLMHistoryManager

R = T.TypeVar("R", bound=BaseModel)


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


class OpenAILLM(LLM[R]):
    def __init__(
        self,
        config: OpenAIConfig,
        available_actions: T.Optional[T.List] = None,
    ):
        super().__init__(config, available_actions)

        if not config.api_key:
            raise ValueError("config file missing api_key")
        if not config.model:
            self._config.model = "gpt-4o-mini"

        self._client = openai.AsyncClient(
            base_url=config.base_url or "https://api.openai.com/v1",
            api_key=config.api_key,
        )
        self.history_manager = LLMHistoryManager(self._config, self._client)

    @LLMHistoryManager.update_history()
    async def ask(
        self, prompt: str, messages: T.Optional[T.List[T.Dict[str, str]]] = None
    ) -> T.Optional[R]:
        if messages is None:
            messages = []
        try:
            logging.info(f"OpenAI input: {prompt}")

            self.io_provider.llm_start_time = time.time()
            self.io_provider.llm_prompt = prompt

            formatted_messages = [
                {"role": msg.get("role", "user"), "content": msg.get("content", "")}
                for msg in messages
            ]
            formatted_messages.append({"role": "user", "content": prompt})

            response = await self._client.chat.completions.create(
                model=self._config.model or "gpt-4o-mini",
                messages=T.cast(T.Any, formatted_messages),
                tools=T.cast(T.Any, self.function_schemas),
                tool_choice="auto",
                timeout=self._config.timeout,
            )

            if not response.choices:
                logging.warning("OpenAI API returned empty choices")
                return None

            message = response.choices[0].message
            self.io_provider.llm_end_time = time.time()

            if message.tool_calls:
                logging.info(f"Received {len(message.tool_calls)} function calls")

                function_call_data = [
                    {
                        "function": {
                            "name": getattr(tc, "function").name,
                            "arguments": getattr(tc, "function").arguments,
                        }
                    }
                    for tc in message.tool_calls
                ]

                actions = convert_function_calls_to_actions(function_call_data)
                result = CortexOutputModel(actions=actions)
                return T.cast(R, result)

            return None
        except Exception as e:
            logging.error(f"OpenAI API error: {e}")
            return None
