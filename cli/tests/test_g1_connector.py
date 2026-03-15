"""Tests for the Unitree G1 robot connector."""

from __future__ import annotations

import time

import pytest

from openeye_ai.connectors.unitree_g1 import (
    G1Connector,
    G1ControlMode,
    G1RobotState,
)


@pytest.fixture
def connector():
    """Create a dry-run connector with short clear duration for fast tests."""
    return G1Connector(mode=G1ControlMode.DRY_RUN, clear_duration=0.1)


def _danger_alert(track_id: str = "obj_0", distance: float = 0.3) -> dict:
    return {
        "human_track_id": track_id,
        "zone": "danger",
        "distance_m": distance,
        "message": f"DANGER: Human {track_id} at {distance:.2f}m — immediate halt recommended",
        "halt_recommended": True,
    }


def _caution_alert(track_id: str = "obj_0", distance: float = 1.0) -> dict:
    return {
        "human_track_id": track_id,
        "zone": "caution",
        "distance_m": distance,
        "message": f"CAUTION: Human {track_id} at {distance:.2f}m — reduce speed",
        "halt_recommended": False,
    }


class TestG1Connector:
    def test_initial_state_is_moving(self, connector: G1Connector):
        assert connector.state == G1RobotState.MOVING

    def test_halt_on_danger_alert(self, connector: G1Connector):
        status = connector.process_safety_alerts(
            alerts=[_danger_alert()],
            zones=[],
        )
        assert status["action"] == "halt"
        assert status["state"] == "halted"
        assert connector.state == G1RobotState.HALTED
        assert status["halt_count"] == 1

    def test_stay_halted_on_continued_danger(self, connector: G1Connector):
        connector.process_safety_alerts([_danger_alert()], [])
        status = connector.process_safety_alerts([_danger_alert()], [])
        assert status["action"] == "hold_halt"
        assert status["state"] == "halted"
        assert status["halt_count"] == 1  # Only one halt issued

    def test_no_halt_on_caution_only(self, connector: G1Connector):
        status = connector.process_safety_alerts([_caution_alert()], [])
        assert status["action"] == "safe"
        assert status["state"] == "moving"

    def test_resume_after_clear_duration(self, connector: G1Connector):
        # Halt
        connector.process_safety_alerts([_danger_alert()], [])
        assert connector.state == G1RobotState.HALTED

        # Clear workspace — first call starts the timer
        status = connector.process_safety_alerts([], [])
        assert status["action"] == "clearing"

        # Wait for clear duration
        time.sleep(0.15)

        # Now should resume
        status = connector.process_safety_alerts([], [])
        assert status["action"] == "resume"
        assert status["state"] == "moving"
        assert status["resume_count"] == 1

    def test_clear_timer_resets_on_new_danger(self, connector: G1Connector):
        # Halt
        connector.process_safety_alerts([_danger_alert()], [])

        # Start clearing
        connector.process_safety_alerts([], [])

        # Danger returns before clear_duration
        connector.process_safety_alerts([_danger_alert()], [])
        assert connector.state == G1RobotState.HALTED

        # Clear again — timer should restart
        connector.process_safety_alerts([], [])
        status = connector.process_safety_alerts([], [])
        # Should still be clearing (not enough time)
        assert status["action"] == "clearing"

    def test_safe_when_no_alerts(self, connector: G1Connector):
        status = connector.process_safety_alerts([], [])
        assert status["action"] == "safe"
        assert status["state"] == "moving"

    def test_emergency_halt(self, connector: G1Connector):
        connector.emergency_halt()
        assert connector.state == G1RobotState.HALTED
        assert connector._halt_count == 1

    def test_shutdown_halts_if_moving(self, connector: G1Connector):
        connector.shutdown()
        assert connector.state == G1RobotState.HALTED

    def test_multiple_halt_resume_cycles(self, connector: G1Connector):
        for _ in range(3):
            connector.process_safety_alerts([_danger_alert()], [])
            time.sleep(0.15)
            connector.process_safety_alerts([], [])
            time.sleep(0.15)
            connector.process_safety_alerts([], [])

        assert connector._halt_count == 3
        assert connector._resume_count == 3

    def test_mixed_danger_and_caution_alerts(self, connector: G1Connector):
        """Danger + caution in same call should still trigger halt."""
        status = connector.process_safety_alerts(
            [_caution_alert("obj_0"), _danger_alert("obj_1")],
            [],
        )
        assert status["action"] == "halt"
        assert status["state"] == "halted"

    def test_none_alerts_treated_as_empty(self, connector: G1Connector):
        """None alerts should not crash — treated as empty list."""
        status = connector.process_safety_alerts(None, None)
        assert status["action"] == "safe"
        assert status["state"] == "moving"

    def test_malformed_alert_without_halt_key(self, connector: G1Connector):
        """Alert dict missing halt_recommended should not trigger halt."""
        status = connector.process_safety_alerts(
            [{"zone": "danger", "message": "incomplete"}],
            [],
        )
        assert status["action"] == "safe"

    def test_shutdown_when_already_halted(self, connector: G1Connector):
        """Shutdown when already halted should not issue a second halt."""
        connector.process_safety_alerts([_danger_alert()], [])
        assert connector._halt_count == 1

        connector.shutdown()
        # Should NOT have incremented — was already halted
        assert connector._halt_count == 1
        assert connector.state == G1RobotState.HALTED

    def test_emergency_halt_when_already_halted(self, connector: G1Connector):
        """Emergency halt when already halted still sends the command (safety)."""
        connector.process_safety_alerts([_danger_alert()], [])
        assert connector._halt_count == 1

        connector.emergency_halt()
        # Emergency halt always sends — even if already halted
        assert connector._halt_count == 2

    def test_empty_alerts_list_is_safe(self, connector: G1Connector):
        """Empty alerts list with non-empty zones should still be safe."""
        status = connector.process_safety_alerts(
            [],
            [{"human_track_id": "obj_0", "zone": "caution", "distance_m": 1.2}],
        )
        assert status["action"] == "safe"

    def test_alert_with_halt_recommended_false(self, connector: G1Connector):
        """Alert explicitly setting halt_recommended=False should not halt."""
        alert = _danger_alert()
        alert["halt_recommended"] = False
        status = connector.process_safety_alerts([alert], [])
        assert status["action"] == "safe"
