import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import json5

from runtime.config import ModeSystemConfig, mode_config_to_dict


@dataclass
class ModeState:
    current_mode: str
    previous_mode: Optional[str] = None
    mode_start_time: float = field(default_factory=time.time)
    transition_history: List[str] = field(default_factory=list)
    last_transition_time: float = 0.0
    user_context: Dict = field(default_factory=dict)


class ModeStatePersistence:
    """Handles state file persistence and runtime config file management."""

    def __init__(self, config: ModeSystemConfig):
        self.config = config

    def _get_state_file_path(self) -> str:
        memory_folder_path = os.path.join(
            os.path.dirname(__file__), "../../config", "memory"
        )
        if not os.path.exists(memory_folder_path):
            os.makedirs(memory_folder_path, mode=0o755, exist_ok=True)
        config_name = getattr(self.config, "config_name", "default")
        state_filename = (
            f"{config_name}.memory.json5"
            if config_name.startswith(".")
            else f".{config_name}.memory.json5"
        )
        return os.path.join(memory_folder_path, state_filename)

    def _load_mode_state(self, state: ModeState):
        state_file = self._get_state_file_path()
        try:
            with open(state_file, "r") as f:
                state_data = json.load(f)
            last_active_mode = state_data.get("last_active_mode")
            if (
                last_active_mode
                and last_active_mode in self.config.modes
                and last_active_mode != self.config.default_mode
            ):
                logging.info(f"Restoring last active mode: {last_active_mode}")
                state.current_mode = last_active_mode
                state.previous_mode = state_data.get("previous_mode")
                saved_history = state_data.get("transition_history", [])
                if saved_history:
                    state.transition_history.extend(saved_history)
                    if len(state.transition_history) > 50:
                        state.transition_history = state.transition_history[-25:]
            else:
                logging.info(f"Using default mode: {self.config.default_mode}")
        except FileNotFoundError:
            logging.debug(f"No state file found at {state_file}, using default mode")
        except (json.JSONDecodeError, KeyError) as e:
            logging.warning(f"Invalid state file format: {e}, using default mode")
        except Exception as e:
            logging.error(f"Error loading mode state: {e}, using default mode")

    def _save_mode_state(self, state: ModeState):
        if not self.config.mode_memory_enabled:
            return
        state_file = self._get_state_file_path()
        try:
            os.makedirs(os.path.dirname(state_file), exist_ok=True)
            state_data = {
                "last_active_mode": state.current_mode,
                "previous_mode": state.previous_mode,
                "timestamp": time.time(),
                "transition_history": state.transition_history[-10:],
            }
            temp_file = state_file + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(state_data, f, indent=2)
            os.rename(temp_file, state_file)
        except Exception as e:
            logging.error(f"Error saving mode state: {e}")

    def _get_runtime_config_path(self) -> str:
        memory_folder_path = os.path.join(
            os.path.dirname(__file__), "../../config", "memory"
        )
        if not os.path.exists(memory_folder_path):
            os.makedirs(memory_folder_path, mode=0o755, exist_ok=True)
        return os.path.join(memory_folder_path, ".runtime.json5")

    def _create_runtime_config_file(self):
        runtime_config_path = self._get_runtime_config_path()
        try:
            runtime_config = mode_config_to_dict(self.config)
            temp_file = runtime_config_path + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json5.dump(runtime_config, f, indent=2)
            os.rename(temp_file, runtime_config_path)
            logging.debug(f"Runtime config file created/updated: {runtime_config_path}")
        except Exception:
            logging.exception("Error creating runtime config file")
