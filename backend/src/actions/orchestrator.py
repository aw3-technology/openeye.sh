import asyncio
import json
import logging
import threading
import typing as T
from concurrent.futures import ThreadPoolExecutor

from actions.base import AgentAction
from actions.execution_strategies import ExecutionStrategy, create_strategy
from llm.output_model import Action
from runtime.config import RuntimeConfig


class ActionOrchestrator:
    """
    Manages data flow for the actions.

    Supports three execution modes:
    - concurrent: All actions execute simultaneously (default)
    - sequential: Actions execute one after another in order
    - dependencies: Actions wait for their dependencies to complete before executing

    Note: It is very important that the actions do not block the event loop.
    """

    promise_queue: T.List[asyncio.Task[T.Any]]
    _config: RuntimeConfig
    _connector_workers: int
    _connector_executor: ThreadPoolExecutor
    _action_instances: T.List[AgentAction]
    _stop_event: threading.Event
    _strategy: ExecutionStrategy
    _completed_actions: T.Dict[str, asyncio.Event]

    def __init__(self, config: RuntimeConfig):
        self._config = config
        self.promise_queue = []
        self._connector_workers = (
            min(12, len(config.agent_actions)) if config.agent_actions else 1
        )
        self._connector_executor = ThreadPoolExecutor(
            max_workers=self._connector_workers,
            thread_name_prefix="action-orchestrator-connector-",
        )
        self._action_instances = []
        self._stop_event = threading.Event()
        self._completed_actions = {}
        self._strategy = create_strategy(
            config.action_execution_mode or "concurrent",
            config.action_dependencies,
        )

    def start(self) -> asyncio.Future:
        """
        Start actions and connectors in separate threads.

        Returns
        -------
        asyncio.Future
            A future object for compatibility with async interfaces.
        """
        for agent_action in self._config.agent_actions:
            if any(
                action.llm_label == agent_action.llm_label
                for action in self._action_instances
            ):
                logging.warning(
                    f"Connector {agent_action.llm_label} already submitted, skipping."
                )
                continue

            agent_action.connector.set_stop_event(self._stop_event)
            self._connector_executor.submit(self._run_connector_loop, agent_action)
            self._action_instances.append(agent_action)

        return asyncio.Future()

    def _run_connector_loop(self, action: AgentAction):
        while not self._stop_event.is_set():
            try:
                action.connector.tick()
            except Exception:
                logging.exception(f"Error in connector {action.llm_label}")
                self._stop_event.wait(timeout=0.1)

    async def flush_promises(self) -> tuple[list[T.Any], list[asyncio.Task[T.Any]]]:
        """
        Flushes the promise queue by waiting for all tasks to complete.

        Returns
        -------
        tuple[list[T.Any], list[asyncio.Task[T.Any]]]
            Completed and pending promise lists.
        """
        if not self.promise_queue:
            return [], []

        done, pending = await asyncio.wait(
            self.promise_queue, return_when=asyncio.ALL_COMPLETED
        )
        self.promise_queue = []
        return list(done), list(pending)

    async def promise(self, actions: list[Action]) -> None:
        """
        Promises the actions to the appropriate connectors using the configured strategy.

        Parameters
        ----------
        actions : list[Action]
            List of actions to promise to connectors.
        """
        self._completed_actions = {
            action.type.lower(): asyncio.Event() for action in actions
        }
        await self._strategy.execute(
            actions,
            self.promise_queue,
            self._create_action_task,
            self._completed_actions,
        )

    def _create_action_task(self, action: Action) -> T.Optional[asyncio.Task[T.Any]]:
        """
        Normalize an action, resolve its AgentAction, and create an asyncio.Task.

        Returns None if the action type is unknown.
        """
        normalized = self._normalize_action(action)
        agent_action = self._get_agent_action(normalized)
        if agent_action is None:
            return None
        return asyncio.create_task(self._promise_action(agent_action, normalized))

    def _normalize_action(self, action: Action) -> Action:
        at = action.type.lower()
        av = action.value
        move_shortcuts = {"stand still", "turn left", "turn right", "move forwards", "move back"}
        if at in move_shortcuts and av == "":
            action.type = "move"
            action.value = at
        return action

    def _get_agent_action(self, action: Action) -> T.Optional[AgentAction]:
        agent_action = next(
            (
                m
                for m in self._config.agent_actions
                if m.llm_label == action.type.lower()
            ),
            None,
        )
        if agent_action is None:
            logging.warning(
                f"Attempted to call non-existent action: {action.type.lower()}."
            )
        return agent_action

    async def _promise_action(self, agent_action: AgentAction, action: Action) -> T.Any:
        logging.debug(
            f"Calling action {agent_action.llm_label} with type {action.type.lower()} and argument {action.value}"
        )

        try:
            parsed_value = json.loads(action.value)
            if isinstance(parsed_value, dict):
                input_params = parsed_value
            else:
                input_params = {"action": action.value}
        except (json.JSONDecodeError, TypeError):
            input_params = {"action": action.value}

        input_type = T.get_type_hints(agent_action.interface)["input"]
        input_type_hints = T.get_type_hints(input_type)

        converted_params = {}
        for key, value in input_params.items():
            if key in input_type_hints:
                expected_type = input_type_hints[key]
                if hasattr(expected_type, "__mro__") and any(
                    base.__name__ == "Enum" for base in expected_type.__mro__
                ):
                    converted_params[key] = expected_type(value)
                elif expected_type is float:
                    converted_params[key] = float(value)
                elif expected_type is int:
                    converted_params[key] = int(value)
                elif expected_type is bool:
                    converted_params[key] = (
                        bool(value)
                        if not isinstance(value, str)
                        else value.lower() in ("true", "1", "yes")
                    )
                else:
                    converted_params[key] = value
            else:
                logging.warning(
                    f"Parameter '{key}' not found in input type hints for action '{agent_action.llm_label}'"
                )

        input_interface = input_type(**converted_params)
        await agent_action.connector.connect(input_interface)
        return input_interface

    def stop(self):
        self._stop_event.set()
        for agent_action in self._action_instances:
            try:
                agent_action.connector.stop()
            except Exception:
                logging.exception(f"Error stopping connector {agent_action.llm_label}")
        self._connector_executor.shutdown(wait=True)
        self._action_instances.clear()

    def __del__(self):
        self.stop()
