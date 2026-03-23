import logging
import os
from typing import Optional

import json5

from actions import load_action
from backgrounds import load_background
from inputs import load_input
from llm import load_llm
from runtime.converter import convert_to_multi_mode
from runtime.env import load_env_vars
from runtime.hook import parse_lifecycle_hooks
from runtime.models import (
    ModeConfig,
    ModeSystemConfig,
    TransitionRule,
    TransitionType,
    add_meta,
)
from runtime.schema import validate_config_schema
from runtime.version import verify_runtime_version
from simulators import load_simulator


def load_mode_config(
    config_name: str, mode_source_path: Optional[str] = None
) -> ModeSystemConfig:
    config_path = (
        os.path.join(os.path.dirname(__file__), "../../config", config_name + ".json5")
        if mode_source_path is None
        else mode_source_path
    )
    with open(config_path, "r", encoding="utf-8") as f:
        try:
            raw_config = json5.load(f)
        except Exception as e:
            raise ValueError(
                f"Failed to parse configuration file '{config_path}': {e}"
            ) from e

    config_version = raw_config.get("version")
    verify_runtime_version(config_version, config_name)
    raw_config = load_env_vars(raw_config)
    validate_config_schema(raw_config)
    raw_config = convert_to_multi_mode(raw_config)

    g_robot_ip = raw_config.get("robot_ip")
    g_api_key = raw_config.get("api_key")
    g_URID = raw_config.get("URID")
    g_ut_eth = raw_config.get("unitree_ethernet")

    # NOTE: load_unitree() removed - no hardware dependencies in OpenEye

    mode_system_config = ModeSystemConfig(
        version=config_version,
        name=raw_config.get("name", "mode_system"),
        default_mode=raw_config["default_mode"],
        config_name=config_name,
        allow_manual_switching=raw_config.get("allow_manual_switching", True),
        mode_memory_enabled=raw_config.get("mode_memory_enabled", True),
        api_key=g_api_key,
        robot_ip=g_robot_ip,
        URID=g_URID,
        unitree_ethernet=g_ut_eth,
        system_governance=raw_config.get("system_governance", ""),
        system_prompt_examples=raw_config.get("system_prompt_examples", ""),
        knowledge_base=raw_config.get("knowledge_base"),
        global_cortex_llm=raw_config.get("cortex_llm"),
        global_lifecycle_hooks=parse_lifecycle_hooks(
            raw_config.get("global_lifecycle_hooks", []), api_key=g_api_key
        ),
        _raw_global_lifecycle_hooks=raw_config.get("global_lifecycle_hooks", []),
    )

    for mode_name, mode_data in raw_config.get("modes", {}).items():
        mode_config = ModeConfig(
            version=mode_data.get("version", "1.0.1"),
            name=mode_name,
            display_name=mode_data.get("display_name", mode_name),
            description=mode_data.get("description", ""),
            system_prompt_base=mode_data.get("system_prompt_base", ""),
            hertz=mode_data.get("hertz", 1.0),
            lifecycle_hooks=parse_lifecycle_hooks(
                mode_data.get("lifecycle_hooks", []), api_key=g_api_key
            ),
            timeout_seconds=mode_data.get("timeout_seconds"),
            remember_locations=mode_data.get("remember_locations", False),
            save_interactions=mode_data.get("save_interactions", False),
            action_execution_mode=mode_data.get("action_execution_mode"),
            action_dependencies=mode_data.get("action_dependencies"),
            _raw_inputs=mode_data.get("agent_inputs", []),
            _raw_llm=mode_data.get("cortex_llm"),
            _raw_simulators=mode_data.get("simulators", []),
            _raw_actions=mode_data.get("agent_actions", []),
            _raw_backgrounds=mode_data.get("backgrounds", []),
            _raw_lifecycle_hooks=mode_data.get("lifecycle_hooks", []),
        )
        mode_system_config.modes[mode_name] = mode_config

    for rule_data in raw_config.get("transition_rules", []):
        rule = TransitionRule(
            from_mode=rule_data["from_mode"],
            to_mode=rule_data["to_mode"],
            transition_type=TransitionType(rule_data["transition_type"]),
            trigger_keywords=rule_data.get("trigger_keywords", []),
            priority=rule_data.get("priority", 1),
            cooldown_seconds=rule_data.get("cooldown_seconds", 0.0),
            timeout_seconds=rule_data.get("timeout_seconds"),
            context_conditions=rule_data.get("context_conditions", {}),
        )
        mode_system_config.transition_rules.append(rule)

    return mode_system_config


def _load_mode_components(mode_config: ModeConfig, system_config: ModeSystemConfig):
    g_api_key = system_config.api_key
    g_ut_eth = system_config.unitree_ethernet
    g_URID = system_config.URID
    g_robot_ip = system_config.robot_ip
    g_mode = mode_config.name

    mode_config.agent_inputs = [
        load_input(
            {
                **inp,
                "config": add_meta(
                    inp.get("config", {}), g_api_key, g_ut_eth, g_URID, g_robot_ip, g_mode,
                ),
            }
        )
        for inp in mode_config._raw_inputs
    ]
    mode_config.simulators = [
        load_simulator(
            {
                **sim,
                "config": add_meta(
                    sim.get("config", {}), g_api_key, g_ut_eth, g_URID, g_robot_ip, g_mode,
                ),
            }
        )
        for sim in mode_config._raw_simulators
    ]
    mode_config.agent_actions = [
        load_action(
            {
                **action,
                "config": add_meta(
                    action.get("config", {}), g_api_key, g_ut_eth, g_URID, g_robot_ip, g_mode,
                ),
            }
        )
        for action in mode_config._raw_actions
    ]
    mode_config.backgrounds = [
        load_background(
            {
                **bg,
                "config": add_meta(
                    bg.get("config", {}), g_api_key, g_ut_eth, g_URID, g_robot_ip, g_mode,
                ),
            }
        )
        for bg in mode_config._raw_backgrounds
    ]
    llm_config = mode_config._raw_llm or system_config.global_cortex_llm
    if llm_config:
        mode_config.cortex_llm = load_llm(
            {
                **llm_config,
                "config": add_meta(
                    llm_config.get("config", {}), g_api_key, g_ut_eth, g_URID, g_robot_ip, g_mode,
                ),
            },
            available_actions=mode_config.agent_actions,
        )
    else:
        raise ValueError(f"No LLM configuration found for mode {mode_config.name}")
