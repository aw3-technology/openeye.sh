import logging
import time
from typing import Dict, List, Optional

from runtime.config import (
    LifecycleHookType,
    ModeConfig,
    ModeSystemConfig,
    TransitionRule,
    TransitionType,
)
from runtime.state import ModeState


class TransitionEvaluator:
    """Evaluates transition rules against current state and context."""

    def __init__(self, config: ModeSystemConfig):
        self.config = config
        self.transition_cooldowns: Dict[str, float] = {}

    def _get_current_mode_config(self, state: ModeState) -> ModeConfig:
        return self.config.modes[state.current_mode]

    async def check_time_based_transitions(self, state: ModeState) -> Optional[str]:
        current_time = time.time()
        mode_duration = current_time - state.mode_start_time
        current_config = self._get_current_mode_config(state)
        if current_config.timeout_seconds and mode_duration >= current_config.timeout_seconds:
            timeout_context = {
                "mode_name": state.current_mode,
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
                    rule.from_mode == state.current_mode or rule.from_mode == "*"
                ) and rule.transition_type == TransitionType.TIME_BASED:
                    if self._can_transition(rule):
                        logging.info(f"Time-based transition triggered: {state.current_mode} -> {rule.to_mode}")
                        return rule.to_mode
        return None

    async def check_context_aware_transitions(self, state: ModeState) -> Optional[str]:
        matching_rules = []
        for rule in self.config.transition_rules:
            if (
                rule.from_mode == state.current_mode or rule.from_mode == "*"
            ) and rule.transition_type == TransitionType.CONTEXT_AWARE:
                if self._can_transition(rule) and self._evaluate_context_conditions(rule, state):
                    matching_rules.append(rule)
        if matching_rules:
            matching_rules.sort(key=lambda r: r.priority, reverse=True)
            target_rule = matching_rules[0]
            logging.info(f"Context-aware transition triggered: {state.current_mode} -> {target_rule.to_mode}")
            return target_rule.to_mode
        return None

    def check_input_triggered_transitions(self, input_text: str, state: ModeState) -> Optional[str]:
        if not input_text:
            return None
        input_lower = input_text.lower()
        matching_rules = []
        for rule in self.config.transition_rules:
            if (
                rule.from_mode == state.current_mode or rule.from_mode == "*"
            ) and rule.transition_type == TransitionType.INPUT_TRIGGERED:
                for keyword in rule.trigger_keywords:
                    if keyword.lower() in input_lower:
                        if self._can_transition(rule):
                            matching_rules.append(rule)
                        break
        if matching_rules:
            matching_rules.sort(key=lambda r: r.priority, reverse=True)
            best_rule = matching_rules[0]
            logging.info(f"Input-triggered transition: {state.current_mode} -> {best_rule.to_mode}")
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

    def _evaluate_context_conditions(self, rule: TransitionRule, state: ModeState) -> bool:
        if not rule.context_conditions:
            return True
        user_context = state.user_context
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
