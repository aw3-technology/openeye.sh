import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from runtime.conditions import evaluate_conditions
from runtime.config import (
    LifecycleHookType,
    ModeConfig,
    ModeSystemConfig,
    TransitionRule,
    TransitionType,
)
from runtime.state_store import ModeStateStore


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
        self._store = ModeStateStore(config)

        if config.default_mode not in config.modes:
            raise ValueError(
                f"Default mode '{config.default_mode}' not found in available modes"
            )

        if config.mode_memory_enabled:
            self._restore_state_from_disk()

        logging.info(f"Mode Manager initialized with current mode: {self.state.current_mode}")
        self._store.create_runtime_config_file()

    @property
    def runtime_config_path(self) -> str:
        return self._store.get_runtime_config_path()

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
        return evaluate_conditions(rule.context_conditions, self.state.user_context)

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
                if self.config.mode_memory_enabled:
                    self._store.save_mode_state(
                        self.state.current_mode,
                        self.state.previous_mode,
                        self.state.transition_history,
                    )
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

    def _restore_state_from_disk(self):
        state_data = self._store.load_mode_state()
        if state_data is None:
            return
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
