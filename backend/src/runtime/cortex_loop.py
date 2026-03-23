import asyncio
import logging


class CortexLoopMixin:
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
