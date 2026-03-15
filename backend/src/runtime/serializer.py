import logging
from typing import Any, Dict

from runtime.models import ModeSystemConfig


def mode_config_to_dict(config: ModeSystemConfig) -> Dict[str, Any]:
    try:
        modes_dict = {}
        for mode_name, mode_config in config.modes.items():
            modes_dict[mode_name] = {
                "name": mode_config.name,
                "display_name": mode_config.display_name,
                "description": mode_config.description,
                "system_prompt_base": mode_config.system_prompt_base,
                "hertz": mode_config.hertz,
                "timeout_seconds": mode_config.timeout_seconds,
                "remember_locations": mode_config.remember_locations,
                "save_interactions": mode_config.save_interactions,
                "agent_inputs": mode_config._raw_inputs,
                "cortex_llm": mode_config._raw_llm,
                "simulators": mode_config._raw_simulators,
                "agent_actions": mode_config._raw_actions,
                "backgrounds": mode_config._raw_backgrounds,
                "lifecycle_hooks": mode_config._raw_lifecycle_hooks,
            }
        transition_rules = []
        for rule in config.transition_rules:
            transition_rules.append(
                {
                    "from_mode": rule.from_mode,
                    "to_mode": rule.to_mode,
                    "transition_type": rule.transition_type.value,
                    "trigger_keywords": rule.trigger_keywords,
                    "priority": rule.priority,
                    "cooldown_seconds": rule.cooldown_seconds,
                    "timeout_seconds": rule.timeout_seconds,
                    "context_conditions": rule.context_conditions,
                }
            )
        return {
            "version": config.version,
            "name": config.name,
            "default_mode": config.default_mode,
            "allow_manual_switching": config.allow_manual_switching,
            "mode_memory_enabled": config.mode_memory_enabled,
            "api_key": config.api_key,
            "robot_ip": config.robot_ip,
            "URID": config.URID,
            "unitree_ethernet": config.unitree_ethernet,
            "system_governance": config.system_governance,
            "system_prompt_examples": config.system_prompt_examples,
            "knowledge_base": config.knowledge_base,
            "cortex_llm": config.global_cortex_llm,
            "global_lifecycle_hooks": config._raw_global_lifecycle_hooks,
            "modes": modes_dict,
            "transition_rules": transition_rules,
        }
    except Exception as e:
        logging.error(f"Error converting config to dict: {e}")
        return {}
