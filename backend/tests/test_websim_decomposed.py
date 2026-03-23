"""Tests for the decomposed WebSim helper methods."""

import sys
from types import ModuleType
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from llm.output_model import Action
from providers.io_provider import Input


# ---------------------------------------------------------------------------
# Stub fastapi/uvicorn before any simulator import.
# ---------------------------------------------------------------------------

def _stub(name, attrs=None):
    if name in sys.modules:
        return
    mod = ModuleType(name)
    for attr in (attrs or []):
        setattr(mod, attr, MagicMock)
    mod.__getattr__ = lambda self_name: MagicMock  # type: ignore
    sys.modules[name] = mod


for _mod_name in [
    "fastapi", "fastapi.responses", "fastapi.staticfiles",
    "fastapi.middleware", "fastapi.middleware.cors",
    "uvicorn", "starlette", "starlette.staticfiles", "starlette.responses",
]:
    _stub(_mod_name, ["FastAPI", "WebSocket", "StaticFiles", "HTMLResponse",
                       "CORSMiddleware", "JSONResponse"])


def _make_inputs(mapping):
    """Helper: build {name: Input(...)} dict."""
    return {k: Input(input=v[0], timestamp=v[1]) for k, v in mapping.items()}


@pytest.fixture()
def websim():
    """Create a WebSim instance with the server start patched out."""
    import simulators.plugins.WebSim as ws_mod

    with (
        patch.object(ws_mod, "create_app", return_value=MagicMock()),
        patch.object(ws_mod, "start_server_thread") as mock_thread,
    ):
        mock_thread.return_value = MagicMock(is_alive=MagicMock(return_value=True))
        from simulators.base import SimulatorConfig
        cfg = SimulatorConfig(name="test", port=9999)
        ws = ws_mod.WebSim(cfg)
        return ws


# ---------------------------------------------------------------------------
# Tests: _collect_inputs
# ---------------------------------------------------------------------------


class TestCollectInputs:
    def test_rezeros_timestamps(self, websim):
        websim.io_provider.add_input("Eyes", "person ahead", 100.5)
        websim.io_provider.add_input("Ears", "quiet", 101.0)
        result = websim._collect_inputs(earliest_time=100.0)
        assert len(result) == 2
        eyes = next(r for r in result if r["input_type"] == "Eyes")
        assert eyes["timestamp"] == pytest.approx(0.5)

    def test_governance_gets_zero_timestamp(self, websim):
        websim.io_provider.add_input("GovernanceEthereum", "rule", 50.0)
        result = websim._collect_inputs(earliest_time=10.0)
        gov = next(r for r in result if r["input_type"] == "GovernanceEthereum")
        assert gov["timestamp"] == 0

    def test_multiple_inputs_ordered(self, websim):
        websim.io_provider.add_input("Eyes", "person", 100.0)
        websim.io_provider.add_input("Ears", "beep", 103.0)
        result = websim._collect_inputs(earliest_time=100.0)
        ears = next(r for r in result if r["input_type"] == "Ears")
        assert ears["timestamp"] == pytest.approx(3.0)


# ---------------------------------------------------------------------------
# Tests: _compute_latency
# ---------------------------------------------------------------------------


class TestComputeLatency:
    def test_computes_all_fields(self, websim):
        websim.io_provider.fuser_start_time = 100.0
        websim.io_provider.fuser_end_time = 102.0
        websim.io_provider.llm_start_time = 101.0
        websim.io_provider.llm_end_time = 105.0

        lat = websim._compute_latency()
        assert lat["fuse_time"] == pytest.approx(2.0)
        assert lat["llm_start"] == pytest.approx(1.0)
        assert lat["processing"] == pytest.approx(4.0)
        assert lat["complete"] == pytest.approx(5.0)

    def test_returns_zeros_when_no_times(self, websim):
        websim.io_provider.fuser_start_time = None
        websim.io_provider.fuser_end_time = None
        websim.io_provider.llm_start_time = None
        websim.io_provider.llm_end_time = None

        lat = websim._compute_latency()
        assert all(v == 0 for v in lat.values())


# ---------------------------------------------------------------------------
# Tests: _apply_actions
# ---------------------------------------------------------------------------


class TestApplyActions:
    def test_move_updates_state(self, websim):
        updated = websim._apply_actions([Action(type="move", value="walk_forward")])
        assert updated is True
        assert websim.state.current_action == "walk_forward"

    def test_speak_updates_state(self, websim):
        updated = websim._apply_actions([Action(type="speak", value="Hello!")])
        assert updated is True
        assert websim.state.last_speech == "Hello!"

    def test_emotion_updates_state(self, websim):
        updated = websim._apply_actions([Action(type="emotion", value="happy")])
        assert updated is True
        assert websim.state.current_emotion == "happy"

    def test_no_update_when_same_value(self, websim):
        websim.state.current_action = "idle"
        updated = websim._apply_actions([Action(type="move", value="idle")])
        assert updated is False

    def test_multiple_actions(self, websim):
        actions = [
            Action(type="move", value="run"),
            Action(type="speak", value="Watch out!"),
            Action(type="emotion", value="alert"),
        ]
        updated = websim._apply_actions(actions)
        assert updated is True
        assert websim.state.current_action == "run"
        assert websim.state.last_speech == "Watch out!"
        assert websim.state.current_emotion == "alert"

    def test_empty_actions_no_update(self, websim):
        assert websim._apply_actions([]) is False


# ---------------------------------------------------------------------------
# Tests: sim (integration of decomposed methods)
# ---------------------------------------------------------------------------


class TestSimIntegration:
    def test_sim_skips_when_not_initialized(self, websim):
        websim._initialized = False
        websim.sim([Action(type="move", value="run")])

    def test_sim_updates_state_dict(self, websim):
        websim.io_provider.add_input("Eyes", "person ahead", 100.0)
        websim.io_provider.fuser_start_time = 100.0
        websim.io_provider.fuser_end_time = 101.0
        websim.io_provider.llm_start_time = 100.5
        websim.io_provider.llm_end_time = 102.0

        with patch.object(websim, "tick"):
            websim.sim([Action(type="speak", value="I see someone")])

        assert websim.state_dict["last_speech"] == "I see someone"
        assert "system_latency" in websim.state_dict
        assert len(websim.state_dict["inputs"]) == 1
