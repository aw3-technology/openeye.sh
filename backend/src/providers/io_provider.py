import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .singleton import singleton


@dataclass
class Input:
    """
    A dataclass representing an input with optional timestamp and tick counter.

    Parameters
    ----------
    input : str
        The input value.
    timestamp : float, optional
        The timestamp associated with the input (default is None).
    tick : int, optional
        The tick counter when this input was added (default is None).
    """

    input: str
    timestamp: Optional[float] = None
    tick: Optional[int] = None


class ThreadSafeAttr:
    """Descriptor that wraps attribute access with the owning object's ``_lock``."""

    def __init__(self, default: Any = None):
        self._default = default

    def __set_name__(self, owner: type, name: str) -> None:
        self._attr = f"_{name}"

    def __get__(self, obj: Any, objtype: type = None) -> Any:
        if obj is None:
            return self
        with obj._lock:
            return getattr(obj, self._attr, self._default)

    def __set__(self, obj: Any, value: Any) -> None:
        with obj._lock:
            setattr(obj, self._attr, value)


@singleton
class IOProvider:
    """
    A thread-safe singleton class for managing inputs, timestamps, and LLM-related data.

    This class provides synchronized access to input storage and various timing metrics
    using thread locks for safe concurrent access.
    """

    fuser_system_prompt: Optional[str] = ThreadSafeAttr()
    fuser_inputs: Optional[str] = ThreadSafeAttr()
    fuser_start_time: Optional[float] = ThreadSafeAttr()
    fuser_end_time: Optional[float] = ThreadSafeAttr()
    llm_prompt: Optional[str] = ThreadSafeAttr()
    llm_start_time: Optional[float] = ThreadSafeAttr()
    llm_end_time: Optional[float] = ThreadSafeAttr()

    def __init__(self):
        self._lock: threading.Lock = threading.Lock()
        self._inputs: Dict[str, Input] = {}
        self._mode_transition_input: Optional[str] = None
        self._variables: Dict[str, Any] = {}
        self._tick_counter: int = 0

    # ── Input management ───────────────────────────────────────────

    @property
    def inputs(self) -> Dict[str, Input]:
        with self._lock:
            return dict(self._inputs)

    def add_input(self, key: str, value: str, timestamp: Optional[float]) -> None:
        with self._lock:
            ts = timestamp if timestamp is not None else time.time()
            self._inputs[key] = Input(
                input=value, timestamp=ts, tick=self._tick_counter
            )

    def remove_input(self, key: str) -> None:
        with self._lock:
            self._inputs.pop(key, None)

    def get_input(self, key: str) -> Optional[Input]:
        with self._lock:
            return self._inputs.get(key)

    def add_input_timestamp(self, key: str, timestamp: float) -> None:
        with self._lock:
            if key in self._inputs:
                existing = self._inputs[key]
                self._inputs[key] = Input(
                    input=existing.input,
                    timestamp=timestamp,
                    tick=existing.tick,
                )

    def get_input_timestamp(self, key: str) -> Optional[float]:
        with self._lock:
            input_obj = self._inputs.get(key)
            return input_obj.timestamp if input_obj else None

    # ── Dynamic variables ──────────────────────────────────────────

    def add_dynamic_variable(self, key: str, value: Any) -> None:
        with self._lock:
            self._variables[key] = value

    def get_dynamic_variable(self, key: str) -> Any:
        with self._lock:
            return self._variables.get(key)

    # ── Mode transition ────────────────────────────────────────────

    def add_mode_transition_input(self, input_text: str) -> None:
        with self._lock:
            if self._mode_transition_input is None:
                self._mode_transition_input = input_text
            else:
                self._mode_transition_input = (
                    self._mode_transition_input + " " + input_text
                )

    @contextmanager
    def mode_transition_input(self):
        try:
            with self._lock:
                current_input = self._mode_transition_input
            yield current_input
        finally:
            self.delete_mode_transition_input()

    def get_mode_transition_input(self) -> Optional[str]:
        with self._lock:
            return self._mode_transition_input

    def delete_mode_transition_input(self) -> None:
        with self._lock:
            self._mode_transition_input = None

    # ── Tick counter ───────────────────────────────────────────────

    @property
    def tick_counter(self) -> int:
        with self._lock:
            return self._tick_counter

    def increment_tick(self) -> int:
        with self._lock:
            self._tick_counter += 1
            return self._tick_counter

    def reset_tick_counter(self) -> None:
        with self._lock:
            self._tick_counter = 0
