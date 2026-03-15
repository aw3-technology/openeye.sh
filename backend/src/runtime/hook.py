import asyncio
import importlib
import logging
import os
import re
import shlex
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class LifecycleHookType(Enum):
    ON_ENTRY = "on_entry"
    ON_EXIT = "on_exit"
    ON_STARTUP = "on_startup"
    ON_SHUTDOWN = "on_shutdown"
    ON_TIMEOUT = "on_timeout"


@dataclass
class LifecycleHook:
    hook_type: LifecycleHookType
    handler_type: str
    handler_config: Dict[str, Any]
    async_execution: bool = True
    timeout_seconds: Optional[float] = 5.0
    on_failure: str = "ignore"
    priority: int = 0


class HookConfig(BaseModel):
    model_config = ConfigDict(extra="allow")


class MessageHookConfig(HookConfig):
    message: str = Field(default="", description="The message to log.")


class CommandHookConfig(HookConfig):
    command: str = Field(default="", description="The shell command to execute.")


class FunctionHookConfig(HookConfig):
    module_name: str = Field(description="Name of the module file (without .py extension) in the hooks directory")
    function: str = Field(description="Name of the function to call")


class ActionHookConfig(HookConfig):
    action_type: str = Field(description="The type/name of the action to execute")
    action_config: Dict[str, Any] = Field(default_factory=dict, description="Configuration dictionary for the action")


class LifecycleHookHandler:
    def __init__(self, config: HookConfig):
        self.config = config

    async def execute(self, context: Dict[str, Any]) -> bool:
        raise NotImplementedError


class MessageHookHandler(LifecycleHookHandler):
    """Handler that logs a message. TTS providers removed for OpenEye."""

    def __init__(self, config: MessageHookConfig):
        super().__init__(config)
        self.config: MessageHookConfig = config

    async def execute(self, context: Dict[str, Any]) -> bool:
        if self.config.message:
            try:
                formatted_message = self.config.message.format(**context)
                logging.info(f"Lifecycle hook message: {formatted_message}")
                return True
            except Exception as e:
                logging.error(f"Error formatting lifecycle message: {e}")
                return False
        return True


class CommandHookHandler(LifecycleHookHandler):
    def __init__(self, config: CommandHookConfig):
        super().__init__(config)
        self.config: CommandHookConfig = config

    async def execute(self, context: Dict[str, Any]) -> bool:
        if not self.config.command:
            logging.warning("No command specified for command hook")
            return False
        try:
            sanitized_context = {k: shlex.quote(str(v)) for k, v in context.items()}
            formatted_command = self.config.command.format(**sanitized_context)
            process = await asyncio.create_subprocess_shell(
                formatted_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()
            if process.returncode == 0:
                if stdout:
                    logging.info(f"Hook command output: {stdout.decode().strip()}")
                return True
            else:
                logging.error(f"Hook command failed with code {process.returncode}: {stderr.decode().strip()}")
                return False
        except Exception as e:
            logging.error(f"Error executing lifecycle command: {e}")
            return False


class FunctionHookHandler(LifecycleHookHandler):
    def __init__(self, config: FunctionHookConfig):
        super().__init__(config)
        self.config: FunctionHookConfig = config

    async def execute(self, context: Dict[str, Any]) -> bool:
        try:
            func = self._find_function_in_module(self.config.module_name, self.config.function)
            if not func:
                return False
            merged_context = {**self.config.model_dump(), **context}
            if asyncio.iscoroutinefunction(func):
                result = await func(merged_context)
            else:
                result = func(merged_context)
            return result is not False
        except Exception as e:
            logging.error(f"Error executing lifecycle function: {e}")
            return False

    def _find_function_in_module(self, module_name: str, function_name: str):
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            hooks_dir = os.path.join(current_dir, "..", "hooks")
            hooks_dir = os.path.abspath(hooks_dir)
            if not os.path.exists(hooks_dir):
                logging.error(f"Hooks directory not found at {hooks_dir}")
                return None
            module_file = os.path.join(hooks_dir, f"{module_name}.py")
            if not os.path.exists(module_file):
                logging.error(f"Module file {module_name}.py not found in hooks directory")
                return None
            with open(module_file, "r", encoding="utf-8") as f:
                file_content = f.read()
            function_pattern = re.compile(
                rf"^(?:async\s+)?def\s+{re.escape(function_name)}\s*\(", re.MULTILINE,
            )
            if not function_pattern.search(file_content):
                logging.error(f"Function {function_name} not found in {module_name}.py")
                return None
            module = importlib.import_module(f"hooks.{module_name}")
            if hasattr(module, function_name):
                func = getattr(module, function_name)
                return func
            else:
                logging.error(f"Function {function_name} found in file but not importable from hooks.{module_name}")
                return None
        except Exception as e:
            logging.error(f"Error searching for function {function_name} in module {module_name}: {e}")
            return None


class ActionHookHandler(LifecycleHookHandler):
    def __init__(self, config: ActionHookConfig):
        super().__init__(config)
        self.config: ActionHookConfig = config
        self.action = None

    async def execute(self, context: Dict[str, Any]) -> bool:
        if not self.action:
            try:
                from actions import load_action
                self.action = load_action(
                    {"type": self.config.action_type, "config": self.config.action_config}
                )
            except Exception as e:
                logging.error(f"Error loading action for lifecycle hook: {e}")
                return False
        if not self.action or not hasattr(self.action, "connector"):
            logging.error("Action loaded but has no connector attribute")
            return False
        try:
            await self.action.connector.connect(context.get("input_data"))
            return True
        except Exception as e:
            logging.error(f"Error executing lifecycle action: {e}")
            return False


def create_hook_handler(hook: LifecycleHook) -> Optional[LifecycleHookHandler]:
    handler_type = hook.handler_type.lower()
    try:
        if handler_type == "message":
            config = MessageHookConfig(**hook.handler_config)
            return MessageHookHandler(config)
        elif handler_type == "command":
            config = CommandHookConfig(**hook.handler_config)
            return CommandHookHandler(config)
        elif handler_type == "function":
            config = FunctionHookConfig(**hook.handler_config)
            return FunctionHookHandler(config)
        elif handler_type == "action":
            config = ActionHookConfig(**hook.handler_config)
            return ActionHookHandler(config)
        else:
            logging.error(f"Unknown hook handler type: {handler_type}")
            return None
    except Exception as e:
        logging.error(f"Error creating hook handler config for {handler_type}: {e}")
        return None


def parse_lifecycle_hooks(
    raw_hooks: List[Dict], api_key: Optional[str] = None
) -> List[LifecycleHook]:
    hooks = []
    for hook_data in raw_hooks:
        try:
            handler_config = hook_data.get("handler_config", {}).copy()
            if api_key is not None and "api_key" not in handler_config:
                handler_config["api_key"] = api_key
            hook = LifecycleHook(
                hook_type=LifecycleHookType(hook_data["hook_type"]),
                handler_type=hook_data["handler_type"],
                handler_config=handler_config,
                async_execution=hook_data.get("async_execution", True),
                timeout_seconds=hook_data.get("timeout_seconds", 5.0),
                on_failure=hook_data.get("on_failure", "ignore"),
                priority=hook_data.get("priority", 0),
            )
            hooks.append(hook)
        except (KeyError, ValueError) as e:
            logging.error(f"Error parsing lifecycle hook: {e}")
    return hooks


async def execute_lifecycle_hooks(
    hooks: List[LifecycleHook],
    hook_type: LifecycleHookType,
    context: Optional[Dict[str, Any]] = None,
) -> bool:
    if context is None:
        context = {}
    context.update({"hook_type": hook_type.value})
    relevant_hooks = [hook for hook in hooks if hook.hook_type == hook_type]
    relevant_hooks.sort(key=lambda h: h.priority, reverse=True)
    if not relevant_hooks:
        return True
    logging.info(f"Executing {len(relevant_hooks)} {hook_type.value} hooks")
    all_successful = True
    for hook in relevant_hooks:
        try:
            handler = create_hook_handler(hook)
            if handler:
                if hook.async_execution:
                    if hook.timeout_seconds:
                        success = await asyncio.wait_for(
                            handler.execute(context), timeout=hook.timeout_seconds
                        )
                    else:
                        success = await handler.execute(context)
                else:
                    success = await handler.execute(context)
                if not success:
                    all_successful = False
                    if hook.on_failure == "abort":
                        logging.error("Lifecycle hook failed with abort policy, stopping execution")
                        return False
            else:
                logging.error(f"Failed to create handler for lifecycle hook: {hook.handler_type}")
                all_successful = False
        except asyncio.TimeoutError:
            logging.error(f"Lifecycle hook timed out after {hook.timeout_seconds} seconds")
            all_successful = False
            if hook.on_failure == "abort":
                return False
        except Exception as e:
            logging.error(f"Error executing lifecycle hook: {e}")
            all_successful = False
            if hook.on_failure == "abort":
                return False
    return all_successful
