import asyncio
import logging
from typing import Optional

from runtime.manager import ModeManager
from runtime.orchestrator_lifecycle import OrchestratorLifecycle


class TransitionHandler:
    """Handles asynchronous mode transitions, decoupled from the cortex loop."""

    def __init__(
        self,
        mode_manager: ModeManager,
        lifecycle: OrchestratorLifecycle,
    ):
        self.mode_manager = mode_manager
        self.lifecycle = lifecycle

        self._mode_transition_event = asyncio.Event()
        self._pending_mode_transition: Optional[str] = None
        self._pending_transition_reason: Optional[str] = None
        self.task: Optional[asyncio.Task] = None

        # Ref to the owning runtime; set after construction via set_runtime()
        self._get_runtime = None

    def set_runtime_getter(self, getter):
        self._get_runtime = getter

    @property
    def pending_mode_transition(self) -> Optional[str]:
        return self._pending_mode_transition

    def schedule_transition(self, new_mode: str, reason: str) -> None:
        self._pending_mode_transition = new_mode
        self._pending_transition_reason = reason
        self._mode_transition_event.set()
        logging.info(
            f"Scheduled mode transition to: {new_mode} (reason: {reason})"
        )

    async def handle_mode_transitions(self) -> None:
        while True:
            try:
                await self._mode_transition_event.wait()

                if self._pending_mode_transition:
                    target_mode = self._pending_mode_transition
                    transition_reason = (
                        self._pending_transition_reason or "input_triggered"
                    )
                    self._pending_mode_transition = None
                    self._pending_transition_reason = None

                    logging.info(
                        f"Processing mode transition to: {target_mode} (reason: {transition_reason})"
                    )

                    success = await self.mode_manager._execute_transition(
                        target_mode, transition_reason
                    )
                    if success:
                        logging.info(
                            f"Mode transition completed successfully: {target_mode}"
                        )
                    else:
                        logging.error(f"Mode transition failed: {target_mode}")

                # Clear the event before processing to avoid losing transitions
                # scheduled during the execution of the current transition
                self._mode_transition_event.clear()
                # Check if a new transition was scheduled during execution
                if self._pending_mode_transition:
                    self._mode_transition_event.set()

            except asyncio.CancelledError:
                logging.debug("Mode transition handler cancelled")
                break
            except Exception as e:
                logging.error(f"Error in mode transition handler: {e}")
                await asyncio.sleep(1.0)

    async def on_mode_transition(self, from_mode: str, to_mode: str) -> None:
        logging.info(f"Handling mode transition: {from_mode} -> {to_mode}")
        rt = self._get_runtime() if self._get_runtime else None

        try:
            if rt:
                rt._is_reloading = True

            await self.lifecycle.stop_current_orchestrators()
            await self.lifecycle.initialize_mode(to_mode, self.mode_manager.config)

            if rt:
                await self.lifecycle.start_orchestrators(
                    rt._run_cortex_loop, self.ensure_task_running
                )

            logging.info(f"Successfully transitioned to mode: {to_mode}")

        except Exception as e:
            logging.error(f"Error during mode transition {from_mode} -> {to_mode}: {e}")
            logging.info(f"Attempting recovery by falling back to previous mode: {from_mode}")
            try:
                await self.lifecycle.initialize_mode(from_mode, self.mode_manager.config)
                if rt:
                    await self.lifecycle.start_orchestrators(
                        rt._run_cortex_loop, self.ensure_task_running
                    )
                logging.info(f"Successfully recovered to mode: {from_mode}")
            except Exception as recovery_error:
                logging.critical(
                    f"Recovery to mode '{from_mode}' also failed: {recovery_error}. "
                    "Runtime may be in a broken state."
                )
                raise e from recovery_error
        finally:
            if rt:
                rt._is_reloading = False

    def ensure_task_running(self) -> None:
        if not self.task or self.task.done():
            self.task = asyncio.create_task(self.handle_mode_transitions())
