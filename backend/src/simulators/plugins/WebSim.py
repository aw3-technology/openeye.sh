import asyncio
import logging
import threading
import time
from typing import Dict, List

from fastapi import WebSocket

from llm.output_model import Action
from providers.io_provider import Input, IOProvider
from simulators.base import Simulator, SimulatorConfig
from simulators.plugins.websim_server import create_app, start_server_thread
from simulators.plugins.websim_state import SimulatorState


class WebSim(Simulator):
    """
    WebSim simulator class for visualizing simulation data in a web interface.
    """

    def __init__(self, config: SimulatorConfig):
        """
        Initialize the WebSim simulator instance.

        Sets up the FastAPI application, mounts static assets, initializes
        the simulator state, and starts the web server in a separate thread.

        Parameters
        ----------
        config : SimulatorConfig
            Configuration settings for the simulator.
        """
        super().__init__(config)
        self.messages: list[str] = []
        self.io_provider = IOProvider()

        self._initialized = False
        self._lock = threading.Lock()
        self._last_tick = time.time()
        self._tick_interval = 0.1  # 100ms tick rate

        self.state_dict = {}

        self.state = SimulatorState(
            inputs={},
            current_action="idle",
            last_speech="",
            current_emotion="",
            system_latency={
                "fuse_time": 0,
                "llm_start": 0,
                "processing": 0,
                "complete": 0,
            },
        )

        logging.info("Initializing WebSim...")

        self.active_connections: List[WebSocket] = []
        self._connections_lock = threading.Lock()

        self.app = create_app(self)
        port = self.config.port or 8765

        try:
            logging.info("Starting WebSim server thread...")
            self.server_thread = start_server_thread(self.app, port)
            self.sleep(1)

            if self.server_thread.is_alive():
                logging.info(
                    f"\033[1;36mWebSim server started successfully - Open http://localhost:{port} in your browser\033[0m"
                )
                self._initialized = True
            else:
                logging.error("WebSim server failed to start")
        except Exception as e:
            logging.error(f"Error starting WebSim server thread: {e}")

    def add_connection(self, ws: WebSocket) -> None:
        """Add a WebSocket connection."""
        with self._connections_lock:
            self.active_connections.append(ws)

    def remove_connection(self, ws: WebSocket) -> None:
        """Remove a WebSocket connection."""
        with self._connections_lock:
            try:
                self.active_connections.remove(ws)
            except ValueError:
                pass

    def get_initial_state(self) -> dict:
        """Return the current state as a dictionary."""
        return self.state.to_dict()

    async def broadcast_state(self):
        """
        Broadcast current state to all connected clients.
        """
        with self._connections_lock:
            connections = list(self.active_connections)
        if not connections:
            return

        try:
            disconnected = []
            for connection in connections:
                try:
                    await connection.send_json(self.state_dict)
                except Exception as e:
                    logging.error(f"Error broadcasting to client: {e}")
                    disconnected.append(connection)

            if disconnected:
                with self._connections_lock:
                    for connection in disconnected:
                        try:
                            self.active_connections.remove(connection)
                        except ValueError:
                            pass

        except Exception as e:
            logging.error(f"Error in broadcast_state: {e}")

    def get_earliest_time(self, inputs: Dict[str, Input]) -> float:
        """
        Get earliest timestamp from inputs.

        Parameters
        ----------
        inputs : Dict[str, Input]
            Dictionary of input types to their Input objects.

        Returns
        -------
        float
            The earliest timestamp found in inputs, or 0.0 if none found.
        """
        earliest_time = float("inf")
        for input_type, input_info in inputs.items():
            logging.debug(f"GET {input_info}")
            if input_type == "GovernanceEthereum":
                continue
            if input_type == "Universal Laws":
                continue
            if input_info.timestamp is not None:
                if input_info.timestamp < earliest_time:
                    earliest_time = float(input_info.timestamp)
        return earliest_time if earliest_time != float("inf") else 0.0

    def tick(self) -> None:
        """Update simulator state."""
        if self._initialized:
            try:
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)

                try:
                    if loop.is_running():
                        future = asyncio.run_coroutine_threadsafe(
                            self.broadcast_state(), loop
                        )
                        try:
                            future.result(timeout=1.0)
                        except TimeoutError:
                            logging.warning("Websim broadcast timed out")
                    else:
                        loop.run_until_complete(self.broadcast_state())
                except Exception as e:
                    logging.warning(f"Websim tick error: {e}")

            except Exception as e:
                logging.error(f"Error in tick: {e}")

            self.sleep(0.5)

    def _collect_inputs(self, earliest_time: float) -> List[dict]:
        """Re-zero input timestamps relative to the earliest input time."""
        rezeroed = []
        for input_type, input_info in self.io_provider.inputs.items():
            timestamp = 0
            if input_type != "GovernanceEthereum" and input_info.timestamp is not None:
                timestamp = input_info.timestamp - earliest_time
            rezeroed.append({
                "input_type": input_type,
                "timestamp": timestamp,
                "input": input_info.input,
            })
        return rezeroed

    def _compute_latency(self) -> Dict[str, float]:
        """Compute system latency metrics from IOProvider timestamps."""
        fuser_start = self.io_provider.fuser_start_time or 0
        fuser_end = self.io_provider.fuser_end_time or 0
        llm_start = self.io_provider.llm_start_time or 0
        llm_end = self.io_provider.llm_end_time or 0
        return {
            "fuse_time": (fuser_end - fuser_start) if (fuser_end and fuser_start) else 0,
            "llm_start": (llm_start - fuser_start) if (llm_start and fuser_start) else 0,
            "processing": (llm_end - llm_start) if (llm_end and llm_start) else 0,
            "complete": (llm_end - fuser_start) if (llm_end and fuser_start) else 0,
        }

    def _apply_actions(self, actions: List[Action]) -> bool:
        """Apply actions to state, return True if any state changed."""
        updated = False
        for action in actions:
            if action.type == "move" and action.value != self.state.current_action:
                self.state.current_action = action.value
                updated = True
            elif action.type == "speak" and action.value != self.state.last_speech:
                self.state.last_speech = action.value
                updated = True
            elif action.type == "emotion" and action.value != self.state.current_emotion:
                self.state.current_emotion = action.value
                updated = True
        return updated

    def sim(self, actions: List[Action]) -> None:
        """
        Handle simulation updates from commands.

        Parameters
        ----------
        actions : List[Action]
            List of actions to process in the simulation.
        """
        if not self._initialized:
            logging.warning("WebSim not initialized, skipping sim update")
            return

        try:
            with self._lock:
                earliest_time = self.get_earliest_time(self.io_provider.inputs)
                input_rezeroed = self._collect_inputs(earliest_time)
                system_latency = self._compute_latency()
                updated = self._apply_actions(actions)

                self.state_dict = {
                    "current_action": self.state.current_action,
                    "last_speech": self.state.last_speech,
                    "current_emotion": self.state.current_emotion,
                    "system_latency": system_latency,
                    "inputs": input_rezeroed,
                }

                logging.info(f"Inputs and LLM Outputs: {self.state_dict}")

            if updated:
                self._last_tick = 0
                self.tick()

        except Exception as e:
            logging.error(f"Error in sim update: {e}")

    async def cleanup(self):
        """
        Clean up resources.
        """
        logging.info("Cleaning up WebSim...")
        self._initialized = False

        for connection in self.active_connections[:]:
            try:
                await connection.close()
            except Exception as e:
                logging.error(f"Error closing connection: {e}")
        self.active_connections.clear()
