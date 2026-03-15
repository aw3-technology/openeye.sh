import asyncio
import logging
import typing as T
from abc import ABC, abstractmethod

from llm.output_model import Action


class ExecutionStrategy(ABC):
    """Strategy interface for action execution modes."""

    @abstractmethod
    async def execute(
        self,
        actions: list[Action],
        promise_queue: list[asyncio.Task[T.Any]],
        create_action_task: T.Callable[[Action], T.Optional[asyncio.Task[T.Any]]],
        completed_actions: T.Dict[str, asyncio.Event],
    ) -> None:
        """
        Execute actions according to the strategy.

        Parameters
        ----------
        actions : list[Action]
            Actions to execute.
        promise_queue : list[asyncio.Task]
            Queue to append created tasks to.
        create_action_task : Callable
            Factory that normalizes an Action, resolves its AgentAction,
            and returns an asyncio.Task (or None if the action is unknown).
        completed_actions : dict[str, asyncio.Event]
            Events to signal when each action completes.
        """


class ConcurrentStrategy(ExecutionStrategy):
    """All actions execute simultaneously."""

    async def execute(self, actions, promise_queue, create_action_task, completed_actions):
        for action in actions:
            logging.debug(f"Sending command: {action}")
            task = create_action_task(action)
            if task is not None:
                promise_queue.append(task)


class SequentialStrategy(ExecutionStrategy):
    """Actions execute one after another in order."""

    async def execute(self, actions, promise_queue, create_action_task, completed_actions):
        for action in actions:
            logging.debug(f"Sending command (sequential): {action}")
            task = create_action_task(action)
            if task is None:
                continue

            promise_queue.append(task)
            await task

            label = action.type.lower()
            if label in completed_actions:
                completed_actions[label].set()


class DependencyStrategy(ExecutionStrategy):
    """Actions wait for their dependencies before executing."""

    def __init__(self, action_dependencies: T.Dict[str, T.List[str]]):
        self._action_dependencies = action_dependencies

    async def execute(self, actions, promise_queue, create_action_task, completed_actions):
        for action in actions:
            logging.debug(f"Sending command (with dependencies): {action}")
            task = asyncio.create_task(
                self._execute_with_deps(action, create_action_task, completed_actions)
            )
            promise_queue.append(task)

    async def _execute_with_deps(
        self,
        action: Action,
        create_action_task: T.Callable[[Action], T.Optional[asyncio.Task[T.Any]]],
        completed_actions: T.Dict[str, asyncio.Event],
    ) -> T.Any:
        label = action.type.lower()
        dependencies = self._action_dependencies.get(label, [])

        for dep in dependencies:
            if dep in completed_actions:
                logging.debug(f"Action '{label}' waiting for dependency '{dep}'")
                await completed_actions[dep].wait()

        task = create_action_task(action)
        if task is None:
            return None

        result = await task

        if label in completed_actions:
            completed_actions[label].set()
            logging.debug(f"Action '{label}' completed")

        return result


def create_strategy(
    mode: str, action_dependencies: T.Optional[T.Dict[str, T.List[str]]] = None
) -> ExecutionStrategy:
    """
    Factory function to create the appropriate execution strategy.

    Parameters
    ----------
    mode : str
        Execution mode: "concurrent", "sequential", or "dependencies".
    action_dependencies : dict, optional
        Dependency map for the dependency strategy.
    """
    if mode == "sequential":
        return SequentialStrategy()
    elif mode == "dependencies":
        return DependencyStrategy(action_dependencies or {})
    else:
        return ConcurrentStrategy()
