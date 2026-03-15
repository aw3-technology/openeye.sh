import asyncio
import logging
from typing import Optional

from actions.orchestrator import ActionOrchestrator
from backgrounds.orchestrator import BackgroundOrchestrator
from fuser import Fuser
from inputs.orchestrator import InputOrchestrator
from providers.config_provider import ConfigProvider
from providers.io_provider import IOProvider
from providers.sleep_ticker_provider import SleepTickerProvider
from providers.telemetry_provider import TelemetryProvider
from runtime.config import ModeSystemConfig, RuntimeConfig
from simulators.orchestrator import SimulatorOrchestrator


class OrchestratorLifecycle:
    """Manages orchestrator creation, startup, shutdown, and task tracking."""

    def __init__(
        self,
        io_provider: IOProvider,
        sleep_ticker_provider: SleepTickerProvider,
        config_provider: ConfigProvider,
        telemetry: TelemetryProvider,
    ):
        self.io_provider = io_provider
        self.sleep_ticker_provider = sleep_ticker_provider
        self.config_provider = config_provider
        self.telemetry = telemetry

        # Current runtime components
        self.current_config: Optional[RuntimeConfig] = None
        self.fuser: Optional[Fuser] = None
        self.action_orchestrator: Optional[ActionOrchestrator] = None
        self.simulator_orchestrator: Optional[SimulatorOrchestrator] = None
        self.background_orchestrator: Optional[BackgroundOrchestrator] = None
        self.input_orchestrator: Optional[InputOrchestrator] = None

        # Tasks for orchestrators
        self.input_listener_task: Optional[asyncio.Task] = None
        self.simulator_task: Optional[asyncio.Future] = None
        self.action_task: Optional[asyncio.Future] = None
        self.background_task: Optional[asyncio.Future] = None
        self.cortex_loop_task: Optional[asyncio.Task] = None

        # Generation counter for cortex loop cancellations during transitions
        self._cortex_loop_generation = 0

    async def initialize_mode(self, mode_name: str, mode_config: ModeSystemConfig) -> None:
        config = mode_config.modes[mode_name]
        config.load_components(mode_config)
        self.current_config = config.to_runtime_config(mode_config)

        logging.info(f"Initializing mode: {config.display_name}")
        logging.info("Setting up cortex components for mode")

        self.fuser = Fuser(self.current_config)
        self.action_orchestrator = ActionOrchestrator(self.current_config)
        self.simulator_orchestrator = SimulatorOrchestrator(self.current_config)
        self.background_orchestrator = BackgroundOrchestrator(self.current_config)

        logging.info(f"Mode '{mode_name}' initialized successfully")

    async def start_orchestrators(self, run_cortex_loop, start_transition_handler) -> None:
        if not self.current_config:
            raise RuntimeError("No current config available")

        self.sleep_ticker_provider.skip_sleep = False

        self.input_orchestrator = InputOrchestrator(self.current_config.agent_inputs)
        self.input_listener_task = asyncio.create_task(self.input_orchestrator.listen())

        if self.simulator_orchestrator:
            self.simulator_task = self.simulator_orchestrator.start()
        if self.action_orchestrator:
            self.action_task = self.action_orchestrator.start()
        if self.background_orchestrator:
            self.background_task = self.background_orchestrator.start()

        self.cortex_loop_task = asyncio.create_task(run_cortex_loop())
        start_transition_handler()

        logging.debug("Orchestrators started successfully")

    async def stop_current_orchestrators(self) -> None:
        logging.debug("Stopping current orchestrators...")

        self._cortex_loop_generation += 1
        self.sleep_ticker_provider.skip_sleep = True

        if self.background_orchestrator:
            self.background_orchestrator.stop()
        if self.simulator_orchestrator:
            logging.debug("Stopping simulator orchestrator")
            self.simulator_orchestrator.stop()
        if self.action_orchestrator:
            logging.debug("Stopping action orchestrator")
            self.action_orchestrator.stop()
        if self.input_orchestrator:
            logging.debug("Stopping input orchestrator")
            self.input_orchestrator.stop()

        tasks_to_cancel = {}
        if self.cortex_loop_task and not self.cortex_loop_task.done():
            logging.debug("Cancelling cortex loop task")
            tasks_to_cancel["cortex_loop"] = self.cortex_loop_task
        if self.input_listener_task and not self.input_listener_task.done():
            logging.debug("Cancelling input listener task")
            tasks_to_cancel["input_listener"] = self.input_listener_task
        if self.simulator_task and not self.simulator_task.done():
            logging.debug("Cancelling simulator task")
            tasks_to_cancel["simulator"] = self.simulator_task
        if self.action_task and not self.action_task.done():
            logging.debug("Cancelling action task")
            tasks_to_cancel["action"] = self.action_task
        if self.background_task and not self.background_task.done():
            logging.debug("Cancelling background task")
            tasks_to_cancel["background"] = self.background_task

        for name, task in tasks_to_cancel.items():
            task.cancel()
            logging.debug(f"Cancelled task: {name}")

        if tasks_to_cancel:
            try:
                done, pending = await asyncio.wait(
                    tasks_to_cancel.values(),
                    timeout=15.0,
                    return_when=asyncio.ALL_COMPLETED,
                )
                if pending:
                    pending_names = [
                        name for name, task in tasks_to_cancel.items() if task in pending
                    ]
                    completed_names = [
                        name for name, task in tasks_to_cancel.items() if task in done
                    ]
                    logging.warning(
                        f"Abandoning {len(pending)} unresponsive tasks: {pending_names}"
                    )
                    logging.info(
                        f"Successfully cancelled {len(done)} tasks: {completed_names}"
                    )
                    logging.info(
                        "Continuing with reload without waiting for unresponsive tasks"
                    )
                else:
                    logging.info(f"All {len(done)} tasks cancelled successfully!")
                    for name, task in tasks_to_cancel.items():
                        try:
                            task.result()
                            logging.info(f"  {name}: Completed normally")
                        except asyncio.CancelledError:
                            logging.info(f"  {name}: Successfully cancelled")
                        except Exception as e:
                            logging.warning(
                                f"  {name}: Exception - {type(e).__name__}: {e}"
                            )
            except Exception as e:
                logging.warning(f"Error during task cancellation: {e}")
                logging.info("Continuing with reload despite cancellation errors")

        self.cortex_loop_task = None
        self.input_listener_task = None
        self.simulator_task = None
        self.action_task = None
        self.background_task = None

    async def cleanup_tasks(self, extra_tasks: list) -> None:
        tasks_to_cancel = list(extra_tasks)

        if self.cortex_loop_task and not self.cortex_loop_task.done():
            tasks_to_cancel.append(self.cortex_loop_task)
        if self.input_listener_task and not self.input_listener_task.done():
            tasks_to_cancel.append(self.input_listener_task)
        if self.simulator_task and not self.simulator_task.done():
            tasks_to_cancel.append(self.simulator_task)
        if self.action_task and not self.action_task.done():
            tasks_to_cancel.append(self.action_task)
        if self.background_task and not self.background_task.done():
            tasks_to_cancel.append(self.background_task)

        for task in tasks_to_cancel:
            task.cancel()

        if tasks_to_cancel:
            try:
                await asyncio.gather(*tasks_to_cancel, return_exceptions=True)
            except Exception as e:
                logging.warning(f"Error during final cleanup: {e}")

        self.config_provider.stop()
        logging.debug("Tasks cleaned up successfully")
