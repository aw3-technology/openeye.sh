import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

import json5

from runtime.config import (
    LifecycleHookType,
    ModeConfig,
    ModeSystemConfig,
    TransitionRule,
    TransitionType,
    mode_config_to_dict,
)


@dataclass
class ModeState:
    current_mode: str
    previous_mode: Optional[str] = None
    mode_start_time: float = field(default_factory=time.time)
    transition_history: List[str] = field(default_factory=list)
    last_transition_time: float = 0.0
    user_context: Dict = field(default_factory=dict)


class ModeManager:
    def __init__(self, config: ModeSystemConfig):
        self.config = config
        self.state = ModeState(current_mode=config.default_mode)
        self.transition_cooldowns: Dict[str, float] = {}
        self.pending_transitions: List[TransitionRule] = []
        self._transition_callbacks: List = []
        self._main_event_loop: Optional[asyncio.AbstractEventLoop] = None
        self._transition_lock = asyncio.Lock()
        self._is_transitioning = False

        if config.default_mode not in config.modes:
            raise ValueError(
                f"Default mode '{config.default_mode}' not found in available modes"
            )

        if config.mode_memory_enabled:
            self._load_mode_state()

        logging.info(f"Mode Manager initialized with current mode: {self.state.current_mode}")
        self._create_runtime_config_file()

    def _get_runtime_config_path(self) -> str:
        memory_folder_path = os.path.join(
            os.path.dirname(__file__), "../../config", "memory"
        )
        if not os.path.exists(memory_folder_path):
            os.makedirs(memory_folder_path, mode=0o755, exist_ok=True)
        return os.path.join(memory_folder_path, ".runtime.json5")

    def _create_runtime_config_file(self):
        runtime_config_path = self._get_runtime_config_path()
        try:
            runtime_config = mode_config_to_dict(self.config)
            temp_file = runtime_config_path + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json5.dump(runtime_config, f, indent=2)
            os.rename(temp_file, runtime_config_path)
            logging.debug(f"Runtime config file created/updated: {runtime_config_path}")
        except Exception:
            logging.exception("Error creating runtime config file")

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        self._main_event_loop = loop

    @property
    def current_mode_config(self) -> ModeConfig:
        return self.config.modes[self.state.current_mode]

    @property
    def current_mode_name(self) -> str:
        return self.state.current_mode

    def add_transition_callback(self, callback: Callable):
        self._transition_callbacks.append(callback)

    def remove_transition_callback(self, callback: Callable):
        if callback in self._transition_callbacks:
            self._transition_callbacks.remove(callback)

    async def _notify_transition_callbacks(self, from_mode: str, to_mode: str):
        for callback in self._transition_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(from_mode, to_mode)
                else:
                    callback(from_mode, to_mode)
            except Exception as e:
                logging.error(f"Error in transition callback: {e}")

    async def check_time_based_transitions(self) -> Optional[str]:
        current_time = time.time()
        mode_duration = current_time - self.state.mode_start_time
        current_config = self.current_mode_config
        if current_config.timeout_seconds and mode_duration >= current_config.timeout_seconds:
            timeout_context = {
                "mode_name": self.state.current_mode,
                "timeout_seconds": current_config.timeout_seconds,
                "actual_duration": mode_duration,
                "timestamp": current_time,
            }
            try:
                await current_config.execute_lifecycle_hooks(
                    LifecycleHookType.ON_TIMEOUT, timeout_context
                )
            except Exception as e:
                logging.error(f"Error executing timeout lifecycle hooks: {e}")
            for rule in self.config.transition_rules:
                if (
                    rule.from_mode == self.state.current_mode or rule.from_mode == "*"
                ) and rule.transition_type == TransitionType.TIME_BASED:
                    if self._can_transition(rule):
                        logging.info(f"Time-based transition triggered: {self.state.current_mode} -> {rule.to_mode}")
                        return rule.to_mode
        return None

    async def check_context_aware_transitions(self) -> Optional[str]:
        matching_rules = []
        for rule in self.config.transition_rules:
            if (
                rule.from_mode == self.state.current_mode or rule.from_mode == "*"
            ) and rule.transition_type == TransitionType.CONTEXT_AWARE:
                if self._can_transition(rule) and self._evaluate_context_conditions(rule):
                    matching_rules.append(rule)
        if matching_rules:
            matching_rules.sort(key=lambda r: r.priority, reverse=True)
            target_rule = matching_rules[0]
            logging.info(f"Context-aware transition triggered: {self.state.current_mode} -> {target_rule.to_mode}")
            return target_rule.to_mode
        return None

    def check_input_triggered_transitions(self, input_text: str) -> Optional[str]:
        if not input_text:
            return None
        input_lower = input_text.lower()
        matching_rules = []
        for rule in self.config.transition_rules:
            if (
                rule.from_mode == self.state.current_mode or rule.from_mode == "*"
            ) and rule.transition_type == TransitionType.INPUT_TRIGGERED:
                for keyword in rule.trigger_keywords:
                    if keyword.lower() in input_lower:
                        if self._can_transition(rule):
                            matching_rules.append(rule)
                        break
        if matching_rules:
            matching_rules.sort(key=lambda r: r.priority, reverse=True)
            best_rule = matching_rules[0]
            logging.info(f"Input-triggered transition: {self.state.current_mode} -> {best_rule.to_mode}")
            return best_rule.to_mode
        return None

    def _can_transition(self, rule: TransitionRule) -> bool:
        current_time = time.time()
        transition_key = f"{rule.from_mode}->{rule.to_mode}"
        if transition_key in self.transition_cooldowns:
            if current_time - self.transition_cooldowns[transition_key] < rule.cooldown_seconds:
                return False
        if rule.to_mode not in self.config.modes:
            logging.warning(f"Target mode '{rule.to_mode}' not found in configuration")
            return False
        return True

    def _evaluate_context_conditions(self, rule: TransitionRule) -> bool:
        if not rule.context_conditions:
            return True
        user_context = self.state.user_context
        for condition_key, condition_value in rule.context_conditions.items():
            if not self._evaluate_single_condition(condition_key, condition_value, user_context):
                return False
        return True

    def _evaluate_single_condition(self, key: str, expected_value, user_context: Dict) -> bool:
        if key not in user_context:
            return False
        actual_value = user_context[key]
        if isinstance(expected_value, dict):
            if "min" in expected_value or "max" in expected_value:
                if not isinstance(actual_value, (int, float)):
                    return False
                if "min" in expected_value and actual_value < expected_value["min"]:
                    return False
                if "max" in expected_value and actual_value > expected_value["max"]:
                    return False
                return True
            elif "contains" in expected_value:
                if not isinstance(actual_value, str):
                    return False
                return expected_value["contains"].lower() in actual_value.lower()
            elif "one_of" in expected_value:
                return actual_value in expected_value["one_of"]
            elif "not" in expected_value:
                return actual_value != expected_value["not"]
        elif isinstance(expected_value, list):
            return actual_value in expected_value
        else:
            return actual_value == expected_value
        return False

    async def request_transition(self, target_mode: str, reason: str = "manual") -> bool:
        if not self.config.allow_manual_switching and reason == "manual":
            logging.warning("Manual mode switching is disabled")
            return False
        if target_mode not in self.config.modes:
            logging.error(f"Target mode '{target_mode}' not found")
            return False
        if target_mode == self.state.current_mode:
            logging.info(f"Already in mode '{target_mode}'")
            return True
        return await self._execute_transition(target_mode, reason)

    async def _execute_transition(self, target_mode: str, reason: str) -> bool:
        async with self._transition_lock:
            if self._is_transitioning:
                return True
            self._is_transitioning = True
            from_mode = self.state.current_mode
            try:
                if from_mode == target_mode:
                    return True
                transition_key = f"{from_mode}->{target_mode}"
                self.transition_cooldowns[transition_key] = time.time()
                from_config = self.config.modes.get(from_mode)
                to_config = self.config.modes[target_mode]
                transition_context = {
                    "from_mode": from_mode,
                    "to_mode": target_mode,
                    "reason": reason,
                    "timestamp": time.time(),
                    "transition_key": transition_key,
                }
                if from_config:
                    await from_config.execute_lifecycle_hooks(
                        LifecycleHookType.ON_EXIT, transition_context.copy()
                    )
                await self.config.execute_global_lifecycle_hooks(
                    LifecycleHookType.ON_EXIT, transition_context.copy()
                )
                self.state.previous_mode = from_mode
                self.state.current_mode = target_mode
                self.state.mode_start_time = time.time()
                self.state.last_transition_time = time.time()
                self.state.transition_history.append(f"{from_mode}->{target_mode}:{reason}")
                if len(self.state.transition_history) > 50:
                    self.state.transition_history = self.state.transition_history[-25:]
                logging.info(f"Mode transition: {from_mode} -> {target_mode} (reason: {reason})")
                await to_config.execute_lifecycle_hooks(
                    LifecycleHookType.ON_ENTRY, transition_context.copy()
                )
                await self.config.execute_global_lifecycle_hooks(
                    LifecycleHookType.ON_ENTRY, transition_context.copy()
                )
                await self._notify_transition_callbacks(from_mode, target_mode)
                self._save_mode_state()
                return True
            except Exception as e:
                logging.error(f"Failed to execute transition {from_mode} -> {target_mode}: {e}")
                return False
            finally:
                self._is_transitioning = False

    def get_available_transitions(self) -> List[str]:
        available = set()
        for rule in self.config.transition_rules:
            if rule.from_mode == self.state.current_mode or rule.from_mode == "*":
                if self._can_transition(rule):
                    available.add(rule.to_mode)
        return list(available)

    def get_mode_info(self) -> Dict:
        current_config = self.current_mode_config
        current_time = time.time()
        mode_duration = current_time - self.state.mode_start_time
        return {
            "current_mode": self.state.current_mode,
            "display_name": current_config.display_name,
            "description": current_config.description,
            "mode_duration": mode_duration,
            "previous_mode": self.state.previous_mode,
            "available_transitions": self.get_available_transitions(),
            "all_modes": list(self.config.modes.keys()),
            "transition_history": self.state.transition_history[-5:],
            "timeout_seconds": current_config.timeout_seconds,
            "time_remaining": (
                max(0, current_config.timeout_seconds - mode_duration)
                if current_config.timeout_seconds
                else None
            ),
        }

    def update_user_context(self, context: Dict):
        self.state.user_context.update(context)

    def get_user_context(self) -> Dict:
        return self.state.user_context.copy()

    async def process_tick(self, input_text: Optional[str]) -> Optional[tuple[str, str]]:
        time_target = await self.check_time_based_transitions()
        if time_target:
            return (time_target, "time_based")
        context_target = await self.check_context_aware_transitions()
        if context_target:
            return (context_target, "context_aware")
        if input_text:
            target_mode = self.check_input_triggered_transitions(input_text)
            if target_mode:
                return (target_mode, "input_triggered")
        return None

    def _get_state_file_path(self) -> str:
        memory_folder_path = os.path.join(
            os.path.dirname(__file__), "../../config", "memory"
        )
        if not os.path.exists(memory_folder_path):
            os.makedirs(memory_folder_path, mode=0o755, exist_ok=True)
        config_name = getattr(self.config, "config_name", "default")
        state_filename = (
            f"{config_name}.memory.json5"
            if config_name.startswith(".")
            else f".{config_name}.memory.json5"
        )
        return os.path.join(memory_folder_path, state_filename)

    def _load_mode_state(self):
        state_file = self._get_state_file_path()
        try:
            with open(state_file, "r") as f:
                state_data = json.load(f)
            last_active_mode = state_data.get("last_active_mode")
            if (
                last_active_mode
                and last_active_mode in self.config.modes
                and last_active_mode != self.config.default_mode
            ):
                logging.info(f"Restoring last active mode: {last_active_mode}")
                self.state.current_mode = last_active_mode
                self.state.previous_mode = state_data.get("previous_mode")
                saved_history = state_data.get("transition_history", [])
                if saved_history:
                    self.state.transition_history.extend(saved_history)
                    if len(self.state.transition_history) > 50:
                        self.state.transition_history = self.state.transition_history[-25:]
            else:
                logging.info(f"Using default mode: {self.config.default_mode}")
        except FileNotFoundError:
            logging.debug(f"No state file found at {state_file}, using default mode")
        except (json.JSONDecodeError, KeyError) as e:
            logging.warning(f"Invalid state file format: {e}, using default mode")
        except Exception as e:
            logging.error(f"Error loading mode state: {e}, using default mode")

    def _save_mode_state(self):
        if not self.config.mode_memory_enabled:
            return
        state_file = self._get_state_file_path()
        try:
            os.makedirs(os.path.dirname(state_file), exist_ok=True)
            state_data = {
                "last_active_mode": self.state.current_mode,
                "previous_mode": self.state.previous_mode,
                "timestamp": time.time(),
                "transition_history": self.state.transition_history[-10:],
            }
            temp_file = state_file + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(state_data, f, indent=2)
            os.rename(temp_file, state_file)
        except Exception as e:
            logging.error(f"Error saving mode state: {e}")
