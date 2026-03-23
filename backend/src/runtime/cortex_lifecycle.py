import asyncio
import logging
from typing import List, Union

from providers.event_bus import EventBus
from providers.openclaw_agent import OpenClawAgent

try:
    from perception_grpc.perception_service import PerceptionGRPCServer

    _GRPC_AVAILABLE = True
except ImportError:
    PerceptionGRPCServer = None  # type: ignore[assignment,misc]
    _GRPC_AVAILABLE = False

from runtime.config import LifecycleHookType


class CortexLifecycleMixin:
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

            await self._run_main_loop()

        except Exception as e:
            logging.error(f"Error in mode-aware cortex runtime: {e}")
            raise
        finally:
            await self._shutdown()

    async def _run_main_loop(self) -> None:
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

                if not awaitables:
                    await asyncio.sleep(0.5)
                    continue
                await asyncio.gather(*awaitables)

            except asyncio.CancelledError:
                logging.debug(
                    "Tasks cancelled during mode transition, continuing..."
                )
                await asyncio.sleep(0.1)

            except Exception as e:
                logging.error(f"Error in orchestrator tasks: {e}")
                await asyncio.sleep(1.0)

    async def _shutdown(self) -> None:
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
