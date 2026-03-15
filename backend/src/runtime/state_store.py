"""File-based state persistence for ModeManager."""

import json
import logging
import os
from typing import Optional

import json5

from runtime.config import ModeSystemConfig, mode_config_to_dict


class ModeStateStore:
    def __init__(self, config: ModeSystemConfig):
        self._config = config

    def _memory_folder(self) -> str:
        path = os.path.join(os.path.dirname(__file__), "../../config", "memory")
        if not os.path.exists(path):
            os.makedirs(path, mode=0o755, exist_ok=True)
        return path

    def get_runtime_config_path(self) -> str:
        return os.path.join(self._memory_folder(), ".runtime.json5")

    def create_runtime_config_file(self) -> None:
        runtime_config_path = self.get_runtime_config_path()
        try:
            runtime_config = mode_config_to_dict(self._config)
            temp_file = runtime_config_path + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json5.dump(runtime_config, f, indent=2)
            os.rename(temp_file, runtime_config_path)
            logging.debug(f"Runtime config file created/updated: {runtime_config_path}")
        except Exception:
            logging.exception("Error creating runtime config file")

    def get_state_file_path(self) -> str:
        config_name = getattr(self._config, "config_name", "default")
        state_filename = (
            f"{config_name}.memory.json5"
            if config_name.startswith(".")
            else f".{config_name}.memory.json5"
        )
        return os.path.join(self._memory_folder(), state_filename)

    def load_mode_state(self) -> Optional[dict]:
        """Load persisted mode state from disk. Returns the raw dict or None."""
        state_file = self.get_state_file_path()
        try:
            with open(state_file, "r") as f:
                return json.load(f)
        except FileNotFoundError:
            logging.debug(f"No state file found at {state_file}, using default mode")
            return None
        except (json.JSONDecodeError, KeyError) as e:
            logging.warning(f"Invalid state file format: {e}, using default mode")
            return None
        except Exception as e:
            logging.error(f"Error loading mode state: {e}, using default mode")
            return None

    def save_mode_state(
        self,
        current_mode: str,
        previous_mode: Optional[str],
        transition_history: list,
    ) -> None:
        state_file = self.get_state_file_path()
        try:
            os.makedirs(os.path.dirname(state_file), exist_ok=True)
            state_data = {
                "last_active_mode": current_mode,
                "previous_mode": previous_mode,
                "timestamp": __import__("time").time(),
                "transition_history": transition_history[-10:],
            }
            temp_file = state_file + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(state_data, f, indent=2)
            os.rename(temp_file, state_file)
        except Exception as e:
            logging.error(f"Error saving mode state: {e}")
