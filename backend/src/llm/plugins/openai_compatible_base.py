"""Base class for OpenAI-compatible LLM plugins (Nebius, OpenAI, OpenRouter)."""

import logging
import time
import typing as T

from llm.function_schemas import convert_function_calls_to_actions
from llm.output_model import CortexOutputModel
from llm import LLM
from providers.llm_history_manager import LLMHistoryManager

R = T.TypeVar("R")


class BaseOpenAICompatibleLLM(LLM[R]):
    """Shared ask() and response-parsing for any OpenAI-compatible endpoint.

    Subclasses must:
      - Set ``_log_prefix`` and ``_default_model`` as class attributes.
      - Initialise ``self._client`` (an ``openai.AsyncClient``) in __init__.
    """

    _log_prefix: str = "LLM"
    _default_model: str = ""

    def _parse_response(self, response) -> T.Optional[R]:
        """Parse an OpenAI ChatCompletion response into actions."""
        if not response.choices:
            logging.warning(f"{self._log_prefix} API returned empty choices")
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

    @LLMHistoryManager.update_history()
    async def ask(
        self, prompt: str, messages: T.Optional[T.List[T.Dict[str, str]]] = None
    ) -> T.Optional[R]:
        if messages is None:
            messages = []
        try:
            logging.info(f"{self._log_prefix} input: {prompt}")

            self.io_provider.llm_start_time = time.time()
            self.io_provider.llm_prompt = prompt

            formatted_messages = [
                {"role": msg.get("role", "user"), "content": msg.get("content", "")}
                for msg in messages
            ]
            formatted_messages.append({"role": "user", "content": prompt})

            response = await self._client.chat.completions.create(
                model=self._config.model or self._default_model,
                messages=T.cast(T.Any, formatted_messages),
                tools=T.cast(T.Any, self.function_schemas),
                tool_choice="auto",
                timeout=self._config.timeout,
            )

            return self._parse_response(response)
        except Exception as e:
            logging.error(f"{self._log_prefix} API error: {e}")
            return None
