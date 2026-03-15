from dataclasses import asdict, dataclass
from typing import Optional


@dataclass
class SimulatorState:
    """Dataclass representing the state of the simulator."""

    inputs: dict
    current_action: str = "idle"
    last_speech: str = ""
    current_emotion: str = ""
    system_latency: Optional[dict] = None

    def to_dict(self):
        """
        Convert the SimulatorState to a dictionary.
        """
        return asdict(self)
