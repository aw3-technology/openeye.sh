import asyncio
import logging
import time
from typing import Callable, Dict, List, Optional

from runtime.config import (
    LifecycleHookType,
    ModeConfig,
    ModeSystemConfig,
    TransitionRule,
    TransitionType,
    mode_config_to_dict,
)
from runtime.state import ModeState, ModeStatePersistence
from runtime.transition_evaluator import TransitionEvaluator


class ModeManager:
    def __init__(self, config: ModeSystemConfig):
        self.config = config
        self.state = ModeState(current_mode=config.default_mode)
        self._persistence = ModeStatePersistence(config)
        self._evaluator = TransitionEvaluator(config)
        self.transition_cooldowns = self._evaluator.transition_cooldowns
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
        return self._persistence._get_runtime_config_path()

    def _create_runtime_config_file(self):
        self._persistence._create_runtime_config_file()

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
        return await self._evaluator.check_time_based_transitions(self.state)

    async def check_context_aware_transitions(self) -> Optional[str]:
        return await self._evaluator.check_context_aware_transitions(self.state)

    def check_input_triggered_transitions(self, input_text: str) -> Optional[str]:
        return self._evaluator.check_input_triggered_transitions(input_text, self.state)

    def _can_transition(self, rule: TransitionRule) -> bool:
        return self._evaluator._can_transition(rule)

    def _evaluate_context_conditions(self, rule: TransitionRule) -> bool:
        return self._evaluator._evaluate_context_conditions(rule, self.state)

    def _evaluate_single_condition(self, key: str, expected_value, user_context: Dict) -> bool:
        return self._evaluator._evaluate_single_condition(key, expected_value, user_context)

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
        return self._persistence._get_state_file_path()

    def _load_mode_state(self):
        self._persistence._load_mode_state(self.state)

    def _save_mode_state(self):
        self._persistence._save_mode_state(self.state)
