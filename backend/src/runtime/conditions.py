"""Pure-function condition evaluator for context-aware mode transitions."""

from typing import Any, Dict


def evaluate_conditions(context_conditions: Dict[str, Any], user_context: Dict) -> bool:
    """Return True if all context conditions are satisfied by the user context."""
    for key, expected in context_conditions.items():
        if not _evaluate_single(key, expected, user_context):
            return False
    return True


def _evaluate_single(key: str, expected_value: Any, user_context: Dict) -> bool:
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
        else:
            return False
    elif isinstance(expected_value, list):
        return actual_value in expected_value
    else:
        return actual_value == expected_value
