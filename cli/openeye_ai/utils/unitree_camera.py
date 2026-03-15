"""Camera source for Unitree G1 humanoid robot.

The G1 exposes its stereo cameras (Intel RealSense D435i) via:
  1. Direct USB (when tethered) — /dev/video* device index
  2. RTSP stream over Wi-Fi — rtsp://<g1-ip>:8554/camera
  3. Unitree SDK2 video channel (via unitree_sdk2py)

This module provides a unified CameraSource that auto-detects the best
available transport for the G1's head-mounted camera.
"""

from __future__ import annotations

import logging
import time
from enum import Enum

from PIL import Image

logger = logging.getLogger(__name__)

class G1Transport(str, Enum):
    USB = "usb"
    RTSP = "rtsp"
    SDK = "sdk"

class G1Camera:
    """Camera source for the Unitree G1 robot.

    Parameters
    ----------
    host : str
        G1 IP address (default: 192.168.123.161, the G1 factory default).
    transport : G1Transport | None
        Force a specific transport. If None, auto-detects in order:
        SDK → USB → RTSP.
    device_index : int
        USB camera device index (only for USB transport).
    rtsp_port : int
        RTSP stream port on the G1.
    max_fps : float
        Max frame rate to pull (throttles if camera is faster).
    """

    def __init__(
        self,
        host: str = "192.168.123.161",
        transport: G1Transport | None = None,
        device_index: int = 0,
        rtsp_port: int = 8554,
        max_fps: float = 15.0,
        reconnect_attempts: int = 3,
    ) -> None:
        self.host = host
        self.device_index = device_index
        self.rtsp_port = rtsp_port
        self.rtsp_url = f"rtsp://{host}:{rtsp_port}/camera"
        self._min_interval = 1.0 / max(max_fps, 0.1) if max_fps > 0 else 0
        self._last_frame_time = 0.0
        self._cap = None
        self._sdk_client = None
        self._transport: G1Transport | None = None
        self._reconnect_attempts = reconnect_attempts
        self._consecutive_failures = 0
        self._max_consecutive_failures = 60  # ~1s at 60Hz read attempts

        if transport:
            self._init_transport(transport)
        else:
            self._auto_detect()

    def _auto_detect(self) -> None:
        """Try transports in priority order: SDK → USB → RTSP."""
        for t in (G1Transport.SDK, G1Transport.USB, G1Transport.RTSP):
            try:
                self._init_transport(t)
                logger.info("G1 camera connected via %s", t.value)
                return
            except Exception as e:
                logger.debug("G1 %s transport failed: %s", t.value, e)
                continue
        raise RuntimeError(
            f"Cannot connect to Unitree G1 camera.\n"
            f"  Tried: SDK, USB (device {self.device_index}), RTSP ({self.rtsp_url})\n"
            f"  Ensure the G1 is powered on and connected."
        )

    def _init_transport(self, transport: G1Transport) -> None:
        if transport == G1Transport.SDK:
            self._init_sdk()
        elif transport == G1Transport.USB:
            self._init_usb()
        elif transport == G1Transport.RTSP:
            self._init_rtsp()
        self._transport = transport

    def _init_sdk(self) -> None:
        """Connect via Unitree SDK2 video channel."""
        try:
            from unitree_sdk2py.core.channel import ChannelFactory
            from unitree_sdk2py.go2.video import VideoClient
        except ImportError:
            raise ImportError(
                "unitree_sdk2py not installed.\n"
                "Install with: pip install unitree-sdk2py\n"
                "Or use --transport usb/rtsp instead."
            )
        self._sdk_client = VideoClient()
        self._sdk_client.set_timeout(5.0)
        self._sdk_client.init()

    def _init_usb(self) -> None:
        """Connect via direct USB (OpenCV VideoCapture)."""
        import cv2

        cap = cv2.VideoCapture(self.device_index)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open USB camera at index {self.device_index}")
        self._cap = cap

    def _init_rtsp(self) -> None:
        """Connect via RTSP stream."""
        import cv2

        cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
        # Minimize RTSP buffer for low latency
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open RTSP stream: {self.rtsp_url}")
        self._cap = cap

    def read_pil(self) -> Image.Image | None:
        """Read a frame and return as PIL RGB Image, or None on failure.

        Respects max_fps throttling. Attempts reconnection on sustained failure.
        """
        now = time.monotonic()
        if now - self._last_frame_time < self._min_interval:
            return None

        frame = self._read_raw()
        if frame is None:
            self._consecutive_failures += 1
            if self._consecutive_failures >= self._max_consecutive_failures:
                logger.warning(
                    "G1 camera: %d consecutive read failures, attempting reconnect...",
                    self._consecutive_failures,
                )
                self._attempt_reconnect()
                self._consecutive_failures = 0
            return None

        self._consecutive_failures = 0
        self._last_frame_time = time.monotonic()
        return frame

    def _read_raw(self) -> Image.Image | None:
        """Read a raw frame from the active transport."""
        if self._transport == G1Transport.SDK:
            return self._read_sdk()
        return self._read_cv2()

    def _read_sdk(self) -> Image.Image | None:
        """Read frame from Unitree SDK2 video channel."""
        try:
            frame_data = self._sdk_client.get_image_sample()
            if frame_data is None:
                return None
            # SDK returns BGR numpy array
            import cv2

            rgb = cv2.cvtColor(frame_data, cv2.COLOR_BGR2RGB)
            return Image.fromarray(rgb)
        except Exception as e:
            logger.debug("SDK frame read failed: %s", e)
            return None

    def _read_cv2(self) -> Image.Image | None:
        """Read frame from OpenCV VideoCapture (USB or RTSP)."""
        import cv2

        if self._cap is None:
            return None
        try:
            ret, frame = self._cap.read()
            if not ret or frame is None:
                return None
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            return Image.fromarray(rgb)
        except cv2.error as e:
            logger.debug("cv2 frame read/convert failed: %s", e)
            return None

    def _attempt_reconnect(self) -> None:
        """Try to reconnect the current transport."""
        if self._transport is None:
            return
        for attempt in range(1, self._reconnect_attempts + 1):
            logger.info("G1 camera reconnect attempt %d/%d via %s",
                        attempt, self._reconnect_attempts, self._transport.value)
            try:
                # Release old resources
                if self._cap is not None:
                    self._cap.release()
                    self._cap = None
                self._init_transport(self._transport)
                logger.info("G1 camera reconnected via %s", self._transport.value)
                return
            except Exception as e:
                logger.warning("Reconnect attempt %d failed: %s", attempt, e)
                time.sleep(min(attempt, 3))  # Brief backoff, capped at 3s
        logger.error("G1 camera reconnection failed after %d attempts", self._reconnect_attempts)

    @property
    def transport_name(self) -> str:
        return self._transport.value if self._transport else "none"

    def release(self) -> None:
        """Release camera resources."""
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        if self._sdk_client is not None:
            try:
                self._sdk_client.close()
            except Exception as exc:
                logging.debug("Error closing SDK client: %s", exc)
            self._sdk_client = None
