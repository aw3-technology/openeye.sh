import asyncio
import logging
from typing import List, Optional, Union

from providers.config_provider import ConfigProvider
from providers.event_bus import EventBus
from providers.io_provider import IOProvider
from providers.openclaw_agent import OpenClawAgent
from providers.sleep_ticker_provider import SleepTickerProvider
from providers.telemetry_provider import TelemetryProvider

try:
    from perception_grpc.perception_service import PerceptionGRPCServer

    _GRPC_AVAILABLE = True
except ImportError:
    PerceptionGRPCServer = None  # type: ignore[assignment,misc]
    _GRPC_AVAILABLE = False

from runtime.config import LifecycleHookType, ModeSystemConfig
from runtime.config_watcher import ConfigWatcher
from runtime.manager import ModeManager
from runtime.orchestrator_lifecycle import OrchestratorLifecycle
from runtime.transitions import TransitionHandler


class ModeCortexRuntime:
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

    async def run(self) -> None:
        try:
            loop = asyncio.get_event_loop()
            self.mode_manager.set_event_loop(loop)
            EventBus().set_event_loop(loop)
            OpenClawAgent().start(loop)

            if not self._mode_initialized:
                startup_context = {
                    "system_name": self.mode_config.name,
                    "initial_mode": self.mode_manager.current_mode_name,
                    "timestamp": asyncio.get_event_loop().time(),
                }

                startup_success = await self.mode_config.execute_global_lifecycle_hooks(
                    LifecycleHookType.ON_STARTUP, startup_context
                )
                if not startup_success:
                    logging.warning("Some global startup hooks failed")

                await self.lifecycle.initialize_mode(
                    self.mode_manager.current_mode_name, self.mode_config
                )
                self._mode_initialized = True

                initial_mode_config = self.mode_config.modes[
                    self.mode_manager.current_mode_name
                ]
                await initial_mode_config.execute_lifecycle_hooks(
                    LifecycleHookType.ON_STARTUP, startup_context
                )

            await self.lifecycle.start_orchestrators(
                self._run_cortex_loop, self.transitions.ensure_task_running
            )

            if _GRPC_AVAILABLE:
                try:
                    grpc_port = 50051
                    self.grpc_server = PerceptionGRPCServer(port=grpc_port)
                    self.grpc_server.start()
                except Exception as e:
                    logging.warning(f"gRPC server failed to start: {e}")
                    self.grpc_server = None
            else:
                logging.info("gRPC not available, perception streaming disabled")

            self.config_watcher.start()

            while True:
                try:
                    awaitables: List[Union[asyncio.Task, asyncio.Future]] = []
                    lc = self.lifecycle
                    if lc.cortex_loop_task and not lc.cortex_loop_task.done():
                        awaitables.append(lc.cortex_loop_task)
                    if self.transitions.task and not self.transitions.task.done():
                        awaitables.append(self.transitions.task)
                    if self.config_watcher.task and not self.config_watcher.task.done():
                        awaitables.append(self.config_watcher.task)
                    if lc.input_listener_task and not lc.input_listener_task.done():
                        awaitables.append(lc.input_listener_task)
                    if lc.simulator_task and not lc.simulator_task.done():
                        awaitables.append(lc.simulator_task)
                    if lc.action_task and not lc.action_task.done():
                        awaitables.append(lc.action_task)
                    if lc.background_task and not lc.background_task.done():
                        awaitables.append(lc.background_task)

                    await asyncio.gather(*awaitables)

                except asyncio.CancelledError:
                    logging.debug(
                        "Tasks cancelled during mode transition, continuing..."
                    )
                    await asyncio.sleep(0.1)

                except Exception as e:
                    logging.error(f"Error in orchestrator tasks: {e}")
                    await asyncio.sleep(1.0)

        except Exception as e:
            logging.error(f"Error in mode-aware cortex runtime: {e}")
            raise
        finally:
            shutdown_context = {
                "system_name": self.mode_config.name,
                "final_mode": self.mode_manager.current_mode_name,
                "timestamp": asyncio.get_event_loop().time(),
            }

            current_config = self.mode_config.modes.get(
                self.mode_manager.current_mode_name
            )
            if current_config:
                await current_config.execute_lifecycle_hooks(
                    LifecycleHookType.ON_SHUTDOWN, shutdown_context
                )

            await self.mode_config.execute_global_lifecycle_hooks(
                LifecycleHookType.ON_SHUTDOWN, shutdown_context
            )

            if self.grpc_server:
                self.grpc_server.stop()

            extra_tasks = []
            if self.config_watcher.task and not self.config_watcher.task.done():
                extra_tasks.append(self.config_watcher.task)
            if self.transitions.task and not self.transitions.task.done():
                extra_tasks.append(self.transitions.task)
            await self.lifecycle.cleanup_tasks(extra_tasks)

    async def _run_cortex_loop(self) -> None:
        current_mode = self.mode_manager.current_mode_name
        lc = self.lifecycle
        cortex_generation = lc._cortex_loop_generation
        logging.info(
            f"Starting cortex loop for mode: {current_mode} (generation {cortex_generation})"
        )

        try:
            while True:
                if cortex_generation != lc._cortex_loop_generation:
                    logging.info(
                        f"Cortex loop generation {cortex_generation} invalidated, stopping gracefully"
                    )
                    return

                skip_status = self.sleep_ticker_provider.skip_sleep
                sleep_duration = (
                    1 / lc.current_config.hertz
                    if lc.current_config and lc.current_config.hertz > 0
                    else 1
                )
                if not skip_status and lc.current_config:
                    await self.sleep_ticker_provider.sleep(sleep_duration)

                await asyncio.sleep(0)
                await self._tick(cortex_generation)
                self.sleep_ticker_provider.skip_sleep = False
        except asyncio.CancelledError:
            logging.info(
                f"Cortex loop for mode '{current_mode}' cancelled, exiting gracefully"
            )
            raise
        except Exception as e:
            logging.error(
                f"Unexpected error in cortex loop for mode '{current_mode}': {e}"
            )
            raise

    async def _tick(self, cortex_generation: int) -> None:
        lc = self.lifecycle
        if not lc.current_config or not lc.fuser or not lc.action_orchestrator:
            logging.warning("Cortex not properly initialized, skipping tick")
            return

        if self._is_reloading:
            logging.debug("Skipping tick during config reload")
            return

        if cortex_generation != lc._cortex_loop_generation:
            logging.debug(
                f"Cortex loop generation {cortex_generation} does not match current generation {lc._cortex_loop_generation}, skipping tick"
            )
            return

        tick_num = self.io_provider.increment_tick()
        logging.debug(f"Processing tick #{tick_num}")

        if tick_num % 30 == 0:
            metrics = self.telemetry.get_metrics()
            logging.info(
                f"[telemetry] tick={tick_num} fps={metrics['current_fps']:.1f} "
                f"frames={metrics['counters']['frames_processed']} "
                f"errors={metrics['counters']['errors_total']}"
            )

        finished_promises, _ = await lc.action_orchestrator.flush_promises()

        prompt = await lc.fuser.fuse(
            lc.current_config.agent_inputs, finished_promises
        )
        if prompt is None:
            logging.debug("No prompt to fuse")
            return

        with self.io_provider.mode_transition_input():
            last_input = self.io_provider.get_mode_transition_input()

        transition_result = await self.mode_manager.process_tick(last_input)
        if transition_result:
            new_mode, transition_reason = transition_result
            self.transitions.schedule_transition(new_mode, transition_reason)
            return

        if self._is_reloading or self.transitions.pending_mode_transition:
            logging.debug("Skipping LLM call during mode transition")
            return

        try:
            output = await lc.current_config.cortex_llm.ask(prompt)
        except asyncio.CancelledError:
            logging.info("LLM call cancelled during mode transition")
            raise

        if cortex_generation != lc._cortex_loop_generation:
            logging.info(
                f"Cortex loop generation {cortex_generation} invalidated after LLM call, discarding response"
            )
            return

        if output is None:
            logging.debug("No output from LLM")
            return

        if self._is_reloading or cortex_generation != lc._cortex_loop_generation:
            logging.debug("Skipping action execution due to mode transition")
            return

        if lc.simulator_orchestrator:
            await lc.simulator_orchestrator.promise(output.actions)

        await lc.action_orchestrator.promise(output.actions)

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
