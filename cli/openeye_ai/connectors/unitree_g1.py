"""Unitree G1 robot connector — translates OpenEye safety signals to motor commands.

Bridges the OpenEye Safety Guardian output to the Unitree G1's motor control API.
When a DANGER zone alert with halt_recommended=True is received, this connector
sends an immediate halt (StopMove) to the G1. When the hazard clears and stays
clear for a configurable duration, it sends a resume signal.

Supports three control modes:
  1. Unitree SDK2 (unitree_sdk2py) — direct motor control via LCM/DDS
  2. HTTP REST — G1's built-in HTTP API (port 8081)
  3. Dry-run — logs commands without sending (for testing / demo without robot)
"""

from __future__ import annotations

import json
import logging
import time
from enum import Enum

logger = logging.getLogger(__name__)

class G1ControlMode(str, Enum):
    SDK = "sdk"
    HTTP = "http"
    DRY_RUN = "dry_run"

class G1RobotState(str, Enum):
    MOVING = "moving"
    HALTED = "halted"
    RESUMING = "resuming"

class G1Connector:
    """Sends halt/resume commands to a Unitree G1 humanoid robot.

    Parameters
    ----------
    host : str
        G1 IP address.
    mode : G1ControlMode
        How to send commands to the robot.
    clear_duration : float
        Seconds the workspace must stay clear before auto-resume.
    http_port : int
        Port for the G1's HTTP control API.
    """

    def __init__(
        self,
        host: str = "192.168.123.161",
        mode: G1ControlMode = G1ControlMode.DRY_RUN,
        clear_duration: float = 2.0,
        http_port: int = 8081,
    ) -> None:
        self.host = host
        self.mode = mode
        self.clear_duration = clear_duration
        self.http_port = http_port

        self._state = G1RobotState.MOVING
        self._halt_time: float | None = None
        self._clear_since: float | None = None
        self._sdk_client = None
        self._halt_count = 0
        self._resume_count = 0

        if mode == G1ControlMode.SDK:
            self._init_sdk()

    def _init_sdk(self) -> None:
        """Initialize Unitree SDK2 sport client."""
        try:
            from unitree_sdk2py.core.channel import ChannelFactory
            from unitree_sdk2py.g1.sport import SportClient
        except ImportError:
            raise ImportError(
                "unitree_sdk2py not installed.\n"
                "Install with: pip install unitree-sdk2py\n"
                "Or use --control-mode http/dry_run instead."
            )
        self._sdk_client = SportClient()
        self._sdk_client.set_timeout(2.0)
        self._sdk_client.init()
        logger.info("G1 SDK sport client initialized")

    def process_safety_alerts(
        self,
        alerts: list[dict],
        zones: list[dict],
    ) -> dict:
        """Process safety alerts and issue halt/resume commands.

        Parameters
        ----------
        alerts : list[dict]
            SafetyAlert dicts from the perception pipeline.
        zones : list[dict]
            SafetyZone dicts from the perception pipeline.

        Returns
        -------
        dict with keys: action, state, halt_count, resume_count, details
        """
        now = time.monotonic()
        alerts = alerts or []
        zones = zones or []
        halt_needed = any(a.get("halt_recommended", False) for a in alerts)

        if halt_needed:
            self._clear_since = None
            if self._state != G1RobotState.HALTED:
                self._halt(alerts)
                return self._status("halt", alerts)
            return self._status("hold_halt", alerts)

        # No halt needed — check if we can resume
        if self._state == G1RobotState.HALTED:
            if self._clear_since is None:
                self._clear_since = now
            elapsed_clear = now - self._clear_since

            if elapsed_clear >= self.clear_duration:
                self._resume()
                return self._status("resume", alerts)

            remaining = self.clear_duration - elapsed_clear
            return self._status(
                "clearing",
                alerts,
                details=f"Workspace clear for {elapsed_clear:.1f}s, "
                f"resume in {remaining:.1f}s",
            )

        return self._status("safe", alerts)

    def _halt(self, alerts: list[dict]) -> None:
        """Send immediate halt command to the G1."""
        self._state = G1RobotState.HALTED
        self._halt_time = time.monotonic()
        self._halt_count += 1

        reasons = [a.get("message", "unknown") for a in alerts if a.get("halt_recommended")]
        reason_str = "; ".join(reasons)

        logger.warning("G1 HALT issued: %s", reason_str)

        if self.mode == G1ControlMode.SDK:
            self._sdk_stop_move()
        elif self.mode == G1ControlMode.HTTP:
            self._http_command("stop_move", {"reason": reason_str}, retries=2)
        else:
            logger.info("[DRY RUN] Would send StopMove to G1 at %s", self.host)

    def _resume(self) -> None:
        """Send resume command to the G1."""
        self._state = G1RobotState.MOVING
        self._clear_since = None
        self._resume_count += 1

        logger.info("G1 RESUME issued — workspace clear for %.1fs", self.clear_duration)

        if self.mode == G1ControlMode.SDK:
            self._sdk_resume()
        elif self.mode == G1ControlMode.HTTP:
            self._http_command("resume_move", {})
        else:
            logger.info("[DRY RUN] Would send ResumeMove to G1 at %s", self.host)

    def _sdk_stop_move(self) -> None:
        """Send StopMove via Unitree SDK2. Retries once on failure (safety-critical)."""
        for attempt in range(2):
            try:
                self._sdk_client.stop_move()
                return
            except Exception as e:
                logger.error("SDK StopMove attempt %d failed: %s", attempt + 1, e)
                if attempt == 0:
                    time.sleep(0.05)  # Brief retry delay
        logger.critical("SDK StopMove FAILED after retries — robot may still be moving!")

    def _sdk_resume(self) -> None:
        """Send a gentle stand-in-place via SDK to release from halt."""
        try:
            # ContinueMove or small velocity command to resume
            self._sdk_client.move(0.0, 0.0, 0.0)
        except Exception as e:
            logger.error("SDK Resume failed: %s", e)

    def _http_command(self, action: str, payload: dict, retries: int = 1) -> None:
        """Send a command via the G1's HTTP API. Retries on failure for halt commands."""
        import urllib.request

        url = f"http://{self.host}:{self.http_port}/api/sport/{action}"
        data = json.dumps(payload).encode("utf-8")

        for attempt in range(1 + retries):
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=2) as resp:
                    if resp.status == 200:
                        return
                    logger.error("G1 HTTP %s returned %d", action, resp.status)
            except Exception as e:
                logger.error("G1 HTTP %s attempt %d failed: %s", action, attempt + 1, e)
            if attempt < retries:
                time.sleep(0.05)

        if action == "stop_move":
            logger.critical("G1 HTTP halt FAILED after retries — robot may still be moving!")

    def _status(
        self,
        action: str,
        alerts: list[dict],
        details: str = "",
    ) -> dict:
        return {
            "action": action,
            "state": self._state.value,
            "halt_count": self._halt_count,
            "resume_count": self._resume_count,
            "active_alerts": len(alerts),
            "details": details,
        }

    @property
    def state(self) -> G1RobotState:
        return self._state

    def emergency_halt(self) -> None:
        """Unconditional immediate halt — call on pipeline crash or signal."""
        logger.critical("G1 EMERGENCY HALT")
        self._state = G1RobotState.HALTED
        self._halt_count += 1
        if self.mode == G1ControlMode.SDK:
            self._sdk_stop_move()
        elif self.mode == G1ControlMode.HTTP:
            self._http_command("stop_move", {"reason": "emergency_halt"}, retries=2)
        else:
            logger.info("[DRY RUN] Emergency halt issued")

    def shutdown(self) -> None:
        """Gracefully shut down — halt robot and release resources."""
        if self._state == G1RobotState.MOVING:
            self.emergency_halt()
        if self._sdk_client is not None:
            try:
                self._sdk_client.close()
            except Exception as exc:
                logging.debug("Error closing G1 SDK client: %s", exc)
