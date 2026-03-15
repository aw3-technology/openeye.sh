"""Tests for IOProvider."""

import threading
import time


def test_add_get_input(io_provider):
    io_provider.add_input("sensor_a", "hello", timestamp=100.0)
    result = io_provider.get_input("sensor_a")
    assert result is not None
    assert result.input == "hello"
    assert result.timestamp == 100.0


def test_add_input_auto_timestamp(io_provider):
    io_provider.add_input("sensor_b", "data", timestamp=None)
    result = io_provider.get_input("sensor_b")
    assert result is not None
    assert result.timestamp is not None
    assert result.timestamp > 0


def test_remove_input(io_provider):
    io_provider.add_input("key", "val", timestamp=1.0)
    assert io_provider.get_input("key") is not None
    io_provider.remove_input("key")
    assert io_provider.get_input("key") is None


def test_remove_nonexistent_input(io_provider):
    io_provider.remove_input("does_not_exist")  # Should not raise


def test_inputs_property_returns_copy(io_provider):
    io_provider.add_input("a", "1", timestamp=1.0)
    inputs = io_provider.inputs
    assert "a" in inputs
    # Mutating the copy should not affect the provider
    inputs.pop("a")
    assert io_provider.get_input("a") is not None


def test_tick_counter(io_provider):
    assert io_provider.tick_counter == 0
    new_val = io_provider.increment_tick()
    assert new_val == 1
    assert io_provider.tick_counter == 1
    io_provider.increment_tick()
    io_provider.increment_tick()
    assert io_provider.tick_counter == 3


def test_reset_tick_counter(io_provider):
    io_provider.increment_tick()
    io_provider.increment_tick()
    io_provider.reset_tick_counter()
    assert io_provider.tick_counter == 0


def test_input_gets_current_tick(io_provider):
    io_provider.increment_tick()
    io_provider.increment_tick()
    io_provider.add_input("s", "data", timestamp=1.0)
    result = io_provider.get_input("s")
    assert result.tick == 2


def test_fuser_properties(io_provider):
    assert io_provider.fuser_system_prompt is None
    io_provider.fuser_system_prompt = "You are a fuser."
    assert io_provider.fuser_system_prompt == "You are a fuser."

    assert io_provider.fuser_inputs is None
    io_provider.fuser_inputs = "input data"
    assert io_provider.fuser_inputs == "input data"


def test_llm_properties(io_provider):
    assert io_provider.llm_prompt is None
    io_provider.llm_prompt = "Think step by step."
    assert io_provider.llm_prompt == "Think step by step."
    io_provider.llm_prompt = None
    assert io_provider.llm_prompt is None


def test_mode_transition_input_context_manager(io_provider):
    io_provider.add_mode_transition_input("hello")
    io_provider.add_mode_transition_input("world")
    assert io_provider.get_mode_transition_input() == "hello world"

    with io_provider.mode_transition_input() as text:
        assert text == "hello world"

    # After context manager, should be cleared
    assert io_provider.get_mode_transition_input() is None


def test_dynamic_variables(io_provider):
    assert io_provider.get_dynamic_variable("key") is None
    io_provider.add_dynamic_variable("key", {"nested": True})
    assert io_provider.get_dynamic_variable("key") == {"nested": True}


def test_thread_safety_tick_counter(io_provider):
    """10 threads each increment tick 100 times — final value should be 1000."""
    errors = []

    def worker():
        try:
            for _ in range(100):
                io_provider.increment_tick()
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors
    assert io_provider.tick_counter == 1000


# ── Edge cases ──────────────────────────────────────────────────────


def test_add_input_timestamp_existing_key(io_provider):
    """add_input_timestamp updates timestamp on existing input."""
    io_provider.add_input("k", "val", timestamp=1.0)
    io_provider.add_input_timestamp("k", 99.0)
    assert io_provider.get_input_timestamp("k") == 99.0
    # Value and tick should be preserved
    inp = io_provider.get_input("k")
    assert inp.input == "val"


def test_add_input_timestamp_nonexistent_key(io_provider):
    """add_input_timestamp on nonexistent key is a no-op."""
    io_provider.add_input_timestamp("missing", 99.0)
    assert io_provider.get_input_timestamp("missing") is None


def test_get_input_timestamp_returns_none(io_provider):
    """get_input_timestamp for missing key returns None."""
    assert io_provider.get_input_timestamp("nope") is None


def test_overwrite_input(io_provider):
    """Adding input with same key overwrites the previous."""
    io_provider.add_input("k", "v1", timestamp=1.0)
    io_provider.add_input("k", "v2", timestamp=2.0)
    result = io_provider.get_input("k")
    assert result.input == "v2"
    assert result.timestamp == 2.0


def test_fuser_timing_properties(io_provider):
    """Fuser start/end time round-trip."""
    assert io_provider.fuser_start_time is None
    assert io_provider.fuser_end_time is None

    io_provider.fuser_start_time = 10.0
    io_provider.fuser_end_time = 20.0
    assert io_provider.fuser_start_time == 10.0
    assert io_provider.fuser_end_time == 20.0


def test_llm_timing_properties(io_provider):
    """LLM start/end time round-trip."""
    assert io_provider.llm_start_time is None
    assert io_provider.llm_end_time is None

    io_provider.llm_start_time = 5.0
    io_provider.llm_end_time = 15.0
    assert io_provider.llm_start_time == 5.0
    assert io_provider.llm_end_time == 15.0


def test_thread_safe_attr_round_trip(io_provider):
    """ThreadSafeAttr properties support get/set via descriptor."""
    io_provider.fuser_system_prompt = "prompt1"
    assert io_provider.fuser_system_prompt == "prompt1"

    io_provider.fuser_inputs = "inputs1"
    assert io_provider.fuser_inputs == "inputs1"

    io_provider.llm_prompt = "llm_prompt"
    assert io_provider.llm_prompt == "llm_prompt"


def test_dynamic_variable_overwrite(io_provider):
    """Overwriting a dynamic variable replaces the value."""
    io_provider.add_dynamic_variable("k", "old")
    io_provider.add_dynamic_variable("k", "new")
    assert io_provider.get_dynamic_variable("k") == "new"


def test_mode_transition_input_single(io_provider):
    """Single transition input (no concatenation)."""
    io_provider.add_mode_transition_input("only")
    assert io_provider.get_mode_transition_input() == "only"


def test_mode_transition_input_delete(io_provider):
    """delete_mode_transition_input clears the value."""
    io_provider.add_mode_transition_input("data")
    io_provider.delete_mode_transition_input()
    assert io_provider.get_mode_transition_input() is None


def test_mode_transition_context_manager_cleans_up_on_exception(io_provider):
    """Context manager should clear transition input even if body raises."""
    io_provider.add_mode_transition_input("before_error")
    try:
        with io_provider.mode_transition_input() as text:
            assert text == "before_error"
            raise ValueError("test error")
    except ValueError:
        pass
    assert io_provider.get_mode_transition_input() is None


def test_inputs_empty_initially(io_provider):
    """Fresh provider has no inputs."""
    assert io_provider.inputs == {}


def test_multiple_inputs(io_provider):
    """Multiple distinct inputs coexist."""
    io_provider.add_input("a", "1", timestamp=1.0)
    io_provider.add_input("b", "2", timestamp=2.0)
    io_provider.add_input("c", "3", timestamp=3.0)
    inputs = io_provider.inputs
    assert len(inputs) == 3
    assert inputs["b"].input == "2"


def test_remove_then_re_add(io_provider):
    """Removing and re-adding a key works."""
    io_provider.add_input("k", "old", timestamp=1.0)
    io_provider.remove_input("k")
    io_provider.add_input("k", "new", timestamp=2.0)
    assert io_provider.get_input("k").input == "new"


def test_tick_counter_after_reset_and_increment(io_provider):
    """Reset then increment starts from 1."""
    io_provider.increment_tick()
    io_provider.increment_tick()
    io_provider.reset_tick_counter()
    val = io_provider.increment_tick()
    assert val == 1
