from typing import Optional

from providers.config_provider import ConfigProvider
from providers.io_provider import IOProvider
from providers.sleep_ticker_provider import SleepTickerProvider
from providers.telemetry_provider import TelemetryProvider

try:
    from perception_grpc.perception_service import PerceptionGRPCServer
except ImportError:
    PerceptionGRPCServer = None  # type: ignore[assignment,misc]

from runtime.config import ModeSystemConfig
from runtime.config_watcher import ConfigWatcher
from runtime.cortex_lifecycle import CortexLifecycleMixin
from runtime.cortex_loop import CortexLoopMixin
from runtime.manager import ModeManager
from runtime.orchestrator_lifecycle import OrchestratorLifecycle
from runtime.transitions import TransitionHandler


class ModeCortexRuntime(CortexLifecycleMixin, CortexLoopMixin):
    """
    Mode-aware cortex runtime that can dynamically switch between different
    operational modes, each with their own configuration, inputs, and actions.
    """

    def __init__(
        self,
        mode_config: ModeSystemConfig,
        mode_config_name: str,
        hot_reload: bool = True,
        check_interval: float = 60,
    ):
        self.mode_config = mode_config
        self.mode_config_name = mode_config_name
        self.mode_manager = ModeManager(mode_config)
        self.io_provider = IOProvider()
        self.sleep_ticker_provider = SleepTickerProvider()
        self.config_provider = ConfigProvider()
        self.telemetry = TelemetryProvider()
        self.grpc_server: Optional[PerceptionGRPCServer] = None

        # Compose sub-modules
        self.lifecycle = OrchestratorLifecycle(
            self.io_provider,
            self.sleep_ticker_provider,
            self.config_provider,
            self.telemetry,
        )
        self.transitions = TransitionHandler(self.mode_manager, self.lifecycle)
        self.transitions.set_runtime_getter(lambda: self)

        config_path = self.mode_manager._get_runtime_config_path() if hot_reload else None
        self.config_watcher = ConfigWatcher(
            config_path, check_interval, lambda: self
        )

        # Setup transition callback
        self.mode_manager.add_transition_callback(self.transitions.on_mode_transition)

        self._mode_initialized = False
        self._is_reloading = False

    def get_mode_info(self) -> dict:
        return self.mode_manager.get_mode_info()

    async def request_mode_change(self, target_mode: str) -> bool:
        return await self.mode_manager.request_transition(target_mode, "manual")

    def get_available_modes(self) -> dict:
        return {
            name: {
                "display_name": config.display_name,
                "description": config.description,
                "is_current": name == self.mode_manager.current_mode_name,
            }
            for name, config in self.mode_config.modes.items()
        }
