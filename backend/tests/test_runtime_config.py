"""Tests for RuntimeConfig dataclass and related types."""

from dataclasses import fields

from runtime.config import (
    ModeConfig,
    ModeSystemConfig,
    RuntimeConfig,
    TransitionRule,
    TransitionType,
)


def test_runtime_config_dataclass_fields():
    field_names = {f.name for f in fields(RuntimeConfig)}
    assert "version" in field_names
    assert "hertz" in field_names
    assert "name" in field_names
    assert "system_prompt_base" in field_names
    assert "cortex_llm" in field_names
    assert "agent_inputs" in field_names
    assert "agent_actions" in field_names


def test_transition_type_enum():
    assert TransitionType.INPUT_TRIGGERED.value == "input_triggered"
    assert TransitionType.TIME_BASED.value == "time_based"
    assert TransitionType.CONTEXT_AWARE.value == "context_aware"
    assert TransitionType.MANUAL.value == "manual"


def test_transition_rule_defaults():
    rule = TransitionRule(
        from_mode="idle",
        to_mode="active",
        transition_type=TransitionType.MANUAL,
    )
    assert rule.trigger_keywords == []
    assert rule.priority == 1
    assert rule.cooldown_seconds == 0.0
    assert rule.timeout_seconds is None


def test_mode_config_defaults():
    config = ModeConfig(
        version="1.0.0",
        name="test_mode",
        display_name="Test Mode",
        description="A test mode",
        system_prompt_base="You are a test.",
    )
    assert config.hertz == 1.0
    assert config.timeout_seconds is None
    assert config.remember_locations is False
    assert config.agent_inputs == []
    assert config.cortex_llm is None


def test_mode_system_config_defaults():
    config = ModeSystemConfig(
        version="1.0.0",
        name="test_system",
        default_mode="idle",
    )
    assert config.allow_manual_switching is True
    assert config.mode_memory_enabled is True
    assert config.api_key is None
    assert config.modes == {}
    assert config.transition_rules == []


# ── Edge cases ──────────────────────────────────────────────────────


def test_transition_type_all_values():
    """All TransitionType enum members exist."""
    members = list(TransitionType)
    assert len(members) == 4
    values = {m.value for m in members}
    assert values == {"input_triggered", "time_based", "context_aware", "manual"}


def test_transition_rule_with_all_fields():
    """TransitionRule with all fields set."""
    rule = TransitionRule(
        from_mode="sleep",
        to_mode="active",
        transition_type=TransitionType.INPUT_TRIGGERED,
        trigger_keywords=["wake", "start"],
        priority=5,
        cooldown_seconds=10.0,
        timeout_seconds=30.0,
        context_conditions={"min_confidence": 0.8},
    )
    assert rule.trigger_keywords == ["wake", "start"]
    assert rule.priority == 5
    assert rule.cooldown_seconds == 10.0
    assert rule.timeout_seconds == 30.0
    assert rule.context_conditions == {"min_confidence": 0.8}


def test_transition_rule_same_from_to():
    """TransitionRule can have same from_mode and to_mode (self-transition)."""
    rule = TransitionRule(
        from_mode="idle",
        to_mode="idle",
        transition_type=TransitionType.MANUAL,
    )
    assert rule.from_mode == rule.to_mode


def test_mode_config_save_interactions_default():
    config = ModeConfig(
        version="1.0.0",
        name="m",
        display_name="M",
        description="d",
        system_prompt_base="p",
    )
    assert config.save_interactions is False


def test_mode_config_with_optional_fields():
    """ModeConfig with optional fields set."""
    config = ModeConfig(
        version="2.0.0",
        name="advanced",
        display_name="Advanced Mode",
        description="An advanced mode",
        system_prompt_base="Be advanced.",
        hertz=10.0,
        timeout_seconds=60.0,
        remember_locations=True,
        save_interactions=True,
        action_execution_mode="parallel",
    )
    assert config.hertz == 10.0
    assert config.timeout_seconds == 60.0
    assert config.remember_locations is True
    assert config.save_interactions is True
    assert config.action_execution_mode == "parallel"


def test_mode_system_config_with_optional_fields():
    """ModeSystemConfig with all optional fields set."""
    config = ModeSystemConfig(
        version="1.0.0",
        name="full_system",
        default_mode="main",
        config_name="my_config",
        allow_manual_switching=False,
        mode_memory_enabled=False,
        api_key="sk-test",
        system_governance="Be safe.",
        system_prompt_examples="Example 1.",
    )
    assert config.config_name == "my_config"
    assert config.allow_manual_switching is False
    assert config.mode_memory_enabled is False
    assert config.api_key == "sk-test"
    assert config.system_governance == "Be safe."


def test_mode_system_config_empty_modes_dict():
    """Default modes dict is empty."""
    config = ModeSystemConfig(
        version="1.0.0",
        name="s",
        default_mode="d",
    )
    assert config.modes == {}
    assert isinstance(config.modes, dict)


def test_mode_config_raw_fields_default_empty():
    """Raw component fields default to empty."""
    config = ModeConfig(
        version="1.0.0",
        name="m",
        display_name="M",
        description="d",
        system_prompt_base="p",
    )
    assert config._raw_inputs == []
    assert config._raw_llm is None
    assert config._raw_simulators == []
    assert config._raw_actions == []
    assert config._raw_backgrounds == []


def test_runtime_config_optional_fields():
    """RuntimeConfig optional fields default to None."""
    field_names = {f.name for f in fields(RuntimeConfig)}
    assert "mode" in field_names
    assert "api_key" in field_names
    assert "robot_ip" in field_names
    assert "action_execution_mode" in field_names
    assert "knowledge_base" in field_names
