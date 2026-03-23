import asyncio
import logging
import os
import time
from typing import Callable, Optional

from runtime.config import ModeSystemConfig, load_mode_config


class ConfigWatcher:
    """Watches the runtime config file for changes and triggers reloads."""

    def __init__(
        self,
        config_path: Optional[str],
        check_interval: float,
        get_runtime: Callable,
    ):
        self.config_path = config_path
        self.check_interval = check_interval
        self._get_runtime = get_runtime
        self.last_modified: Optional[float] = self._get_file_mtime() if config_path else None
        self.task: Optional[asyncio.Task] = None

        if config_path:
            logging.info(
                f"Hot-reload enabled for runtime config: {config_path} (check interval: {check_interval}s)"
            )

    def _get_file_mtime(self) -> float:
        if self.config_path and os.path.exists(self.config_path):
            return os.path.getmtime(self.config_path)
        return 0.0

    async def _check_config_changes(self) -> None:
        while True:
            try:
                await asyncio.sleep(self.check_interval)

                if not self.config_path or not os.path.exists(self.config_path):
                    continue

                current_mtime = self._get_file_mtime()

                if self.last_modified and current_mtime > self.last_modified:
                    logging.info(
                        f"Runtime config file changed, reloading: {self.config_path}"
                    )
                    await self._reload_config()
                    self.last_modified = current_mtime

            except asyncio.CancelledError:
                logging.debug("Config watcher cancelled")
                break
            except Exception as e:
                logging.error(f"Error checking config changes: {e}")
                await asyncio.sleep(10)

    async def _reload_config(self) -> None:
        rt = self._get_runtime()
        try:
            logging.info(
                f"Runtime config file changed, triggering reload: {self.config_path}"
            )

            rt._is_reloading = True

            current_mode = rt.mode_manager.current_mode_name

            logging.info("Loading configuration from the new runtime file")
            try:
                new_mode_config = load_mode_config(
                    rt.mode_config_name,
                    mode_source_path=rt.mode_manager._get_runtime_config_path(),
                )
            except Exception as e:
                logging.error(
                    f"Failed to load new config, keeping current configuration: {e}"
                )
                return

            await rt.lifecycle.stop_current_orchestrators()

            rt.mode_config = new_mode_config
            rt.mode_manager.config = new_mode_config

            if current_mode not in new_mode_config.modes:
                logging.warning(
                    f"Current mode '{current_mode}' not found in reloaded config, switching to default mode '{new_mode_config.default_mode}'"
                )
                current_mode = new_mode_config.default_mode

            rt.mode_manager.state.current_mode = current_mode
            rt.mode_manager.state.mode_start_time = time.time()
            rt.mode_manager.state.last_transition_time = time.time()
            rt.mode_manager.state.transition_history.append(
                f"config_reload->{current_mode}:hot_reload"
            )

            mode_config = rt.mode_config.modes.get(current_mode)
            await rt.lifecycle.initialize_mode(current_mode, mode_config)
            await rt.lifecycle.start_orchestrators(rt._run_cortex_loop, rt.transitions.ensure_task_running)

            logging.info(
                f"Mode configuration reloaded successfully, active mode: {current_mode}"
            )

        except Exception as e:
            logging.error(f"Failed to reload mode configuration: {e}")
            logging.error("Attempting to restart with previous configuration")
            try:
                current_mode = rt.mode_manager.current_mode_name
                mode_config = rt.mode_config.modes.get(current_mode)
                await rt.lifecycle.initialize_mode(current_mode, mode_config)
                await rt.lifecycle.start_orchestrators(rt._run_cortex_loop, rt.transitions.ensure_task_running)
                logging.info("Successfully recovered with previous configuration")
            except Exception as recovery_error:
                logging.critical(
                    f"Recovery failed, runtime may be in a broken state: {recovery_error}"
                )
        finally:
            rt._is_reloading = False

    def start(self) -> None:
        if self.config_path:
            self.task = asyncio.create_task(self._check_config_changes())
