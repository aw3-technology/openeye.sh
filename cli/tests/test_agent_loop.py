"""Tests for AgentLoop and helper functions (User Stories 85-86)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from openeye_ai.agent.loop import (
    AgentLoop,
    _build_llm_prompt,
    _build_scene_summary,
    _diff_detections,
    _parse_llm_response,
)
from openeye_ai.schema import BBox, DetectedObject


def _det(label: str, conf: float = 0.9) -> DetectedObject:
    return DetectedObject(label=label, confidence=conf, bbox=BBox(x=0.1, y=0.2, w=0.3, h=0.4))


# ── _diff_detections ──────────────────────────────────────────────────


def test_diff_detections_appeared():
    prev = [_det("desk")]
    curr = [_det("desk"), _det("person")]
    desc, sig = _diff_detections(prev, curr)
    assert "appeared: person" in desc
    assert sig > 0


def test_diff_detections_disappeared():
    prev = [_det("desk"), _det("person")]
    curr = [_det("desk")]
    desc, sig = _diff_detections(prev, curr)
    assert "disappeared: person" in desc
    assert sig > 0


def test_diff_detections_no_change():
    prev = [_det("desk")]
    curr = [_det("desk")]
    desc, sig = _diff_detections(prev, curr)
    assert desc == ""
    assert sig == 0.0


def test_diff_detections_empty_inputs():
    desc, sig = _diff_detections([], [])
    assert desc == ""
    assert sig == 0.0


def test_diff_detections_significance_capped():
    prev = []
    curr = [_det("a"), _det("b"), _det("c"), _det("d"), _det("e")]
    _, sig = _diff_detections(prev, curr)
    assert sig <= 1.0


# ── _build_scene_summary ─────────────────────────────────────────────


def test_build_scene_summary_with_detections():
    dets = [_det("person", 0.95), _det("desk", 0.88)]
    summary = _build_scene_summary(dets)
    assert "2 objects" in summary
    assert "person" in summary
    assert "desk" in summary


def test_build_scene_summary_empty():
    assert "Empty scene" in _build_scene_summary([])


# ── _build_llm_prompt ────────────────────────────────────────────────


def test_build_llm_prompt_structure():
    prompt = _build_llm_prompt(
        goal="monitor safety",
        scene_summary="2 objects — person, desk",
        memory_context="No prior observations.",
        current_plan=["Watch for hazards"],
        change_description="appeared: person",
    )
    assert "GOAL: monitor safety" in prompt
    assert "CURRENT SCENE:" in prompt
    assert "CHANGE DETECTED: appeared: person" in prompt
    assert "MEMORY" in prompt
    assert "Watch for hazards" in prompt
    assert "THOUGHT:" in prompt


def test_build_llm_prompt_no_plan():
    prompt = _build_llm_prompt(
        goal="monitor",
        scene_summary="empty",
        memory_context="none",
        current_plan=[],
        change_description="",
    )
    assert "No plan yet." in prompt
    assert "No changes detected" in prompt


# ── _parse_llm_response ─────────────────────────────────────────────


def test_parse_llm_response_valid():
    response = """THOUGHT: Person is near hazard zone.
ACTION: alert — person near soldering iron
PLAN:
1. Monitor person position
2. Track hand proximity
3. Alert if reaching for iron
PLAN_CHANGED: yes"""
    reasoning = _parse_llm_response(response)
    assert "Person is near hazard zone" in reasoning.chain_of_thought
    assert "alert" in reasoning.decided_action
    assert len(reasoning.current_plan) == 3
    assert reasoning.plan_changed is True


def test_parse_llm_response_malformed():
    response = "This is just random text without any structure."
    reasoning = _parse_llm_response(response)
    assert reasoning.chain_of_thought == ""
    assert reasoning.decided_action == ""
    assert reasoning.current_plan == []
    assert reasoning.plan_changed is False


def test_parse_llm_response_partial():
    response = "THOUGHT: Something is happening.\nACTION: continue monitoring"
    reasoning = _parse_llm_response(response)
    assert reasoning.chain_of_thought == "Something is happening."
    assert reasoning.decided_action == "continue monitoring"
    assert reasoning.plan_changed is False


# ── AgentLoop integration ────────────────────────────────────────────


def test_agent_loop_runs_ticks(fake_adapter, memory_store):
    from tests.conftest import FakeCamera

    camera = FakeCamera()
    loop = AgentLoop(
        adapters={"fake": fake_adapter},
        camera=camera,
        hz=100,
        goal="test goal",
        memory_store=memory_store,
    )

    events = []
    loop.on_tick(lambda e: events.append(e))

    tick_count = 0

    def _stop_after_3(event):
        nonlocal tick_count
        if event.phase == "act":
            tick_count += 1
            if tick_count >= 3:
                loop.stop()

    loop.on_tick(_stop_after_3)
    loop.run()

    act_events = [e for e in events if e.phase == "act"]
    assert len(act_events) == 3
    assert act_events[0].tick == 1
    assert act_events[2].tick == 3


def test_agent_loop_stop(fake_adapter, memory_store):
    from tests.conftest import FakeCamera

    camera = FakeCamera()
    loop = AgentLoop(
        adapters={"fake": fake_adapter},
        camera=camera,
        hz=100,
        memory_store=memory_store,
    )

    def _stop_immediately(event):
        if event.phase == "act":
            loop.stop()

    loop.on_tick(_stop_immediately)
    loop.run()

    assert loop.running is False
    assert loop.tick == 1


def test_agent_loop_with_llm_call(fake_adapter, memory_store):
    from tests.conftest import FakeCamera

    camera = FakeCamera()
    mock_llm = MagicMock(return_value="THOUGHT: Test thought\nACTION: test action\nPLAN_CHANGED: no")

    loop = AgentLoop(
        adapters={"fake": fake_adapter},
        camera=camera,
        hz=100,
        goal="test",
        memory_store=memory_store,
        llm_call=mock_llm,
    )

    def _stop(event):
        if event.phase == "act":
            loop.stop()

    loop.on_tick(_stop)
    loop.run()

    mock_llm.assert_called_once()
    prompt_arg = mock_llm.call_args[0][0]
    assert "GOAL: test" in prompt_arg


def test_agent_loop_llm_failure_graceful(fake_adapter, memory_store):
    from tests.conftest import FakeCamera

    camera = FakeCamera()
    mock_llm = MagicMock(side_effect=RuntimeError("LLM unavailable"))

    loop = AgentLoop(
        adapters={"fake": fake_adapter},
        camera=camera,
        hz=100,
        memory_store=memory_store,
        llm_call=mock_llm,
    )

    events = []
    loop.on_tick(lambda e: events.append(e))

    def _stop(event):
        if event.phase == "act":
            loop.stop()

    loop.on_tick(_stop)
    loop.run()

    # Should still complete the tick with fallback reasoning
    act_events = [e for e in events if e.phase == "act"]
    assert len(act_events) == 1
    assert act_events[0].action_taken == "continue monitoring"


def test_agent_loop_camera_returns_none(fake_adapter, memory_store):
    """When camera returns None, loop should skip processing and emit no act events."""
    from tests.conftest import FakeCamera

    camera = FakeCamera(frames=0)  # returns None immediately
    loop = AgentLoop(
        adapters={"fake": fake_adapter},
        camera=camera,
        hz=100,
        memory_store=memory_store,
    )

    events = []
    loop.on_tick(lambda e: events.append(e))

    import threading

    def _stop_soon():
        import time
        time.sleep(0.2)
        loop.stop()

    t = threading.Thread(target=_stop_soon, daemon=True)
    t.start()
    loop.run()
    t.join(timeout=1)

    # No act events should fire since camera always returns None
    act_events = [e for e in events if e.phase == "act"]
    assert len(act_events) == 0
