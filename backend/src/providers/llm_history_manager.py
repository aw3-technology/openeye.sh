import asyncio
import functools
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, List, Optional, TypeVar, Union

import openai

from llm import LLMConfig

from .io_provider import IOProvider

R = TypeVar("R")


@dataclass
class ChatMessage:
    role: str
    content: str


ACTION_MAP = {
    "emotion": "Agent felt: {}.",
    "speak": "Agent said: {}",
    "move": "Agent performed this motion: {}.",
}


class LLMHistoryManager:
    def __init__(
        self,
        config: LLMConfig,
        client: Union[openai.AsyncClient, openai.OpenAI],
        system_prompt: str = "You are a helpful assistant that summarizes a succession of events and interactions accurately and concisely. You are watching an agent named **** interact with people and the world. Your goal is to help **** remember what the agent saw and heard, and how the agent responded to those inputs.",
        summary_command: str = "\nConsidering the new information, write an updated summary of the situation for ****. Emphasize information that **** needs to know to respond to people and situations in the best possible and most compelling way.",
    ):
        self.client = client
        self.config = config
        self.agent_name = self.config.agent_name
        self.system_prompt = (
            system_prompt.replace("****", self.agent_name)
            if self.agent_name
            else system_prompt
        )
        self.summary_command = (
            summary_command.replace("****", self.agent_name)
            if self.agent_name
            else summary_command
        )
        self.frame_index = 0
        self._summary_task: Optional[asyncio.Task] = None
        self.history: List[ChatMessage] = []
        self.io_provider = IOProvider()

    async def summarize_messages(self, messages: List[ChatMessage]) -> ChatMessage:
        timeout = 10.0
        try:
            if not messages:
                return ChatMessage(role="system", content="No history to summarize")
            summary_prompt = ""
            if len(messages) == 4:
                summary_prompt += f"{messages[0].content}\n"
                summary_prompt += "\nNow, the following new information has arrived. "
                summary_prompt += f"{messages[2].content}\n"
                summary_prompt += f"{messages[3].content}\n"
            else:
                for msg in messages:
                    summary_prompt += f"{msg.content}\n"
            summary_prompt += self.summary_command
            summary_prompt = (
                summary_prompt.replace("****", self.agent_name)
                if self.agent_name
                else summary_prompt
            )
            api_kwargs = {
                "model": self.config.model or "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": summary_prompt},
                ],
            }
            if isinstance(self.client, openai.AsyncClient):
                response = await asyncio.wait_for(
                    self.client.chat.completions.create(**api_kwargs), timeout=timeout,
                )
            else:
                loop = asyncio.get_running_loop()
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        functools.partial(self.client.chat.completions.create, **api_kwargs),
                    ),
                    timeout=timeout,
                )
            if not response or not response.choices:
                return ChatMessage(role="system", content="Error: Received invalid response from API")
            summary = response.choices[0].message.content
            if summary is None:
                return ChatMessage(role="system", content="Error: Received empty summary from API")
            return ChatMessage(role="assistant", content=f"Previously, {summary}")
        except asyncio.TimeoutError:
            return ChatMessage(role="system", content="Error: API request timed out")
        except openai.APIError as e:
            return ChatMessage(role="system", content=f"Error: API service unavailable: {str(e)}")
        except Exception as e:
            logging.error(f"Error summarizing messages: {type(e).__name__}: {e}")
            return ChatMessage(role="system", content="Error summarizing state")

    async def start_summary_task(self, messages: List[ChatMessage]):
        if not messages:
            return
        try:
            if self._summary_task and not self._summary_task.done():
                return
            messages_copy = messages.copy()
            num_summarized = len(messages_copy)
            self._summary_task = asyncio.create_task(self.summarize_messages(messages_copy))

            def callback(task):
                try:
                    if task.cancelled():
                        return
                    summary_message = task.result()
                    if summary_message.role == "assistant":
                        del messages[:num_summarized]
                        messages.insert(0, summary_message)
                    elif summary_message.role == "system" and "Error" in summary_message.content:
                        target_length = self.config.history_length
                        if target_length is not None and len(messages) > target_length:
                            excess = len(messages) - target_length
                            del messages[:excess]
                except Exception as e:
                    logging.error(f"Error in summary task callback: {type(e).__name__}: {e}")
                    target_length = self.config.history_length
                    if target_length is not None and len(messages) > target_length:
                        excess = len(messages) - target_length
                        del messages[:excess]

            self._summary_task.add_done_callback(callback)
        except Exception as e:
            logging.error(f"Error starting summary task: {type(e).__name__}: {e}")

    def get_messages(self) -> List[dict]:
        return [{"role": msg.role, "content": msg.content} for msg in self.history]

    @staticmethod
    def update_history() -> (
        Callable[[Callable[..., Awaitable[R]]], Callable[..., Awaitable[R]]]
    ):
        def decorator(func: Callable[..., Awaitable[R]]) -> Callable[..., Awaitable[R]]:
            @functools.wraps(func)
            async def wrapper(self: Any, prompt: str, *args: Any, **kwargs: Any) -> R:
                if getattr(self, "_skip_state_management", False):
                    return await func(self, prompt, *args, **kwargs)
                if self._config.history_length == 0:
                    response = await func(self, prompt, [], *args, **kwargs)
                    self.history_manager.frame_index += 1
                    return response
                self.agent_name = self._config.agent_name
                cycle = self.history_manager.frame_index
                current_tick = self.io_provider.tick_counter
                formatted_inputs = f"{self.agent_name} sensed the following: "
                for input_type, input_info in self.io_provider.inputs.items():
                    if input_info.tick == current_tick:
                        formatted_inputs += f"{input_type}. {input_info.input} | "
                formatted_inputs = formatted_inputs.replace("..", ".")
                formatted_inputs = formatted_inputs.replace("  ", " ")
                inputs = ChatMessage(role="user", content=formatted_inputs)
                self.history_manager.history.append(inputs)
                messages = self.history_manager.get_messages()
                response = await func(self, prompt, messages, *args, **kwargs)
                if response is not None:
                    action_message = (
                        "Given that information, **** took these actions: "
                        + (
                            " | ".join(
                                ACTION_MAP[action.type.lower()].format(
                                    action.value if action.value else ""
                                )
                                for action in response.actions
                                if action.type.lower() in ACTION_MAP
                            )
                        )
                    )
                    action_message = action_message.replace("****", self.agent_name)
                    self.history_manager.history.append(
                        ChatMessage(role="assistant", content=action_message)
                    )
                    if (
                        self.history_manager.config.history_length > 0
                        and len(self.history_manager.history)
                        > self.history_manager.config.history_length
                    ):
                        await self.history_manager.start_summary_task(
                            self.history_manager.history
                        )
                else:
                    if (
                        self.history_manager.history
                        and self.history_manager.history[-1].role == "user"
                    ):
                        self.history_manager.history.pop()
                self.history_manager.frame_index += 1
                return response
            return wrapper
        return decorator
