from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from actions.base import AgentAction
from backgrounds.base import Background
from inputs.base import Sensor
from llm import LLM
from runtime.hook import (
    LifecycleHook,
    LifecycleHookType,
    execute_lifecycle_hooks,
)
from simulators.base import Simulator


@dataclass
class RuntimeConfig:
    version: str
    hertz: float
    name: str
    system_prompt_base: str
    system_governance: str
    system_prompt_examples: str
    agent_inputs: List[Sensor]
    cortex_llm: LLM
    simulators: List[Simulator]
    agent_actions: List[AgentAction]
    backgrounds: List[Background]
    mode: Optional[str] = None
    api_key: Optional[str] = None
    robot_ip: Optional[str] = None
    URID: Optional[str] = None
    unitree_ethernet: Optional[str] = None
    action_execution_mode: Optional[str] = None
    action_dependencies: Optional[Dict[str, List[str]]] = None
    knowledge_base: Optional[Dict[str, Any]] = None


def add_meta(
    config: Dict,
    g_api_key: Optional[str],
    g_ut_eth: Optional[str],
    g_URID: Optional[str],
    g_robot_ip: Optional[str],
    g_mode: Optional[str] = None,
) -> dict[str, str]:
    if "api_key" not in config and g_api_key is not None:
        config["api_key"] = g_api_key
    if "unitree_ethernet" not in config and g_ut_eth is not None:
        config["unitree_ethernet"] = g_ut_eth
    if "URID" not in config and g_URID is not None:
        config["URID"] = g_URID
    if "robot_ip" not in config and g_robot_ip is not None:
        config["robot_ip"] = g_robot_ip
    if "mode" not in config and g_mode is not None:
        config["mode"] = g_mode
    return config


class TransitionType(Enum):
    INPUT_TRIGGERED = "input_triggered"
    TIME_BASED = "time_based"
    CONTEXT_AWARE = "context_aware"
    MANUAL = "manual"


@dataclass
class TransitionRule:
    from_mode: str
    to_mode: str
    transition_type: TransitionType
    trigger_keywords: List[str] = field(default_factory=list)
    priority: int = 1
    cooldown_seconds: float = 0.0
    timeout_seconds: Optional[float] = None
    context_conditions: Dict = field(default_factory=dict)


@dataclass
class ModeConfig:
    version: str
    name: str
    display_name: str
    description: str
    system_prompt_base: str
    hertz: float = 1.0
    timeout_seconds: Optional[float] = None
    remember_locations: bool = False
    save_interactions: bool = False
    lifecycle_hooks: List[LifecycleHook] = field(default_factory=list)
    _raw_lifecycle_hooks: List[Dict] = field(default_factory=list)
    agent_inputs: List[Sensor] = field(default_factory=list)
    cortex_llm: Optional[LLM] = None
    simulators: List[Simulator] = field(default_factory=list)
    agent_actions: List[AgentAction] = field(default_factory=list)
    backgrounds: List[Background] = field(default_factory=list)
    action_execution_mode: Optional[str] = None
    action_dependencies: Optional[Dict[str, List[str]]] = None
    _raw_inputs: List[Dict] = field(default_factory=list)
    _raw_llm: Optional[Dict] = None
    _raw_simulators: List[Dict] = field(default_factory=list)
    _raw_actions: List[Dict] = field(default_factory=list)
    _raw_backgrounds: List[Dict] = field(default_factory=list)

    def to_runtime_config(self, global_config: "ModeSystemConfig") -> RuntimeConfig:
        if self.cortex_llm is None:
            raise ValueError(f"No LLM configured for mode {self.name}")
        return RuntimeConfig(
            version=self.version,
            hertz=self.hertz,
            mode=self.name,
            name=f"{global_config.name}_{self.name}",
            system_prompt_base=self.system_prompt_base,
            system_governance=global_config.system_governance,
            system_prompt_examples=global_config.system_prompt_examples,
            agent_inputs=self.agent_inputs,
            cortex_llm=self.cortex_llm,
            simulators=self.simulators,
            agent_actions=self.agent_actions,
            backgrounds=self.backgrounds,
            robot_ip=global_config.robot_ip,
            api_key=global_config.api_key,
            URID=global_config.URID,
            unitree_ethernet=global_config.unitree_ethernet,
            action_execution_mode=self.action_execution_mode,
            action_dependencies=self.action_dependencies,
            knowledge_base=global_config.knowledge_base,
        )

    def load_components(self, system_config: "ModeSystemConfig"):
        import logging

        from runtime.loader import _load_mode_components

        logging.info(f"Loading components for mode: {self.name}")
        _load_mode_components(self, system_config)
        logging.info(f"Components loaded successfully for mode: {self.name}")

    async def execute_lifecycle_hooks(
        self, hook_type: LifecycleHookType, context: Optional[Dict[str, Any]] = None
    ) -> bool:
        if context is None:
            context = {}
        context.update(
            {
                "mode_name": self.name,
                "mode_display_name": self.display_name,
                "mode_description": self.description,
            }
        )
        return await execute_lifecycle_hooks(self.lifecycle_hooks, hook_type, context)


@dataclass
class ModeSystemConfig:
    version: str
    name: str
    default_mode: str
    config_name: str = ""
    allow_manual_switching: bool = True
    mode_memory_enabled: bool = True
    api_key: Optional[str] = None
    robot_ip: Optional[str] = None
    URID: Optional[str] = None
    unitree_ethernet: Optional[str] = None
    system_governance: str = ""
    system_prompt_examples: str = ""
    knowledge_base: Optional[Dict[str, Any]] = None
    global_cortex_llm: Optional[Dict] = None
    global_lifecycle_hooks: List[LifecycleHook] = field(default_factory=list)
    _raw_global_lifecycle_hooks: List[Dict] = field(default_factory=list)
    modes: Dict[str, ModeConfig] = field(default_factory=dict)
    transition_rules: List[TransitionRule] = field(default_factory=list)

    async def execute_global_lifecycle_hooks(
        self, hook_type: LifecycleHookType, context: Optional[Dict[str, Any]] = None
    ) -> bool:
        if context is None:
            context = {}
        context.update({"system_name": self.name, "is_global_hook": True})
        return await execute_lifecycle_hooks(
            self.global_lifecycle_hooks, hook_type, context
        )
