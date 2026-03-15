"""
VideoStream - OpenCV webcam capture replacing om1_vlm.VideoStream.

Captures frames from a webcam, encodes them as base64 JPEG strings,
and passes them to an async callback at a configurable FPS.
"""

import asyncio
import base64
import logging
import threading
import time
from typing import Callable, List, Optional

import cv2


class VideoStream:
    def __init__(
        self,
        frame_callback: Callable,
        fps: int = 10,
        device_index: int = 0,
        reconnect_attempts: int = 5,
        reconnect_delay: float = 2.0,
    ):
        self.frame_callback = frame_callback
        self.fps = fps
        self.device_index = device_index
        self.reconnect_attempts = reconnect_attempts
        self.reconnect_delay = reconnect_delay
        self._running = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._frame_callbacks: List[Callable] = []

    def register_frame_callback(self, callback: Callable):
        self._frame_callbacks.append(callback)

    @property
    def running(self) -> bool:
        return self._running.is_set()

    def start(self):
        if self._running.is_set():
            return
        self._running.set()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        logging.info(f"VideoStream started on device {self.device_index} at {self.fps} FPS")

    def stop(self):
        self._running.clear()
        if self._thread:
            # Timeout must exceed max reconnect time (attempts * delay)
            max_reconnect_time = self.reconnect_attempts * self.reconnect_delay
            self._thread.join(timeout=max_reconnect_time + 5.0)
            self._thread = None
        logging.info("VideoStream stopped")

    def _open_camera(self) -> Optional[cv2.VideoCapture]:
        """Open the camera device, returning the capture object or None."""
        cap = cv2.VideoCapture(self.device_index)
        if not cap.isOpened():
            logging.error(f"Failed to open camera device {self.device_index}")
            return None
        return cap

    def _reconnect(self, cap: Optional[cv2.VideoCapture]) -> Optional[cv2.VideoCapture]:
        """Attempt to reconnect to the camera with retries."""
        if cap is not None:
            try:
                cap.release()
            except Exception as exc:
                logging.debug("Error releasing camera during reconnect: %s", exc)

        for attempt in range(1, self.reconnect_attempts + 1):
            if not self._running.is_set():
                logging.info("VideoStream stopped during reconnect, aborting")
                return None
            logging.warning(
                f"Camera reconnect attempt {attempt}/{self.reconnect_attempts}..."
            )
            time.sleep(self.reconnect_delay)
            if not self._running.is_set():
                logging.info("VideoStream stopped during reconnect, aborting")
                return None
            new_cap = self._open_camera()
            if new_cap is not None:
                logging.info(f"Camera reconnected on attempt {attempt}")
                return new_cap

        logging.error(
            f"Failed to reconnect camera after {self.reconnect_attempts} attempts"
        )
        return None

    def _capture_loop(self):
        cap = self._open_camera()
        if cap is None:
            self._running.clear()
            return

        interval = 1.0 / self.fps
        loop = asyncio.new_event_loop()
        self._loop = loop
        consecutive_failures = 0

        try:
            while self.running:
                start = time.time()
                ret, frame = cap.read()
                if not ret or frame is None:
                    consecutive_failures += 1
                    logging.warning(
                        f"Failed to read frame (consecutive: {consecutive_failures})"
                    )
                    if consecutive_failures >= 3:
                        cap = self._reconnect(cap)
                        if cap is None:
                            logging.error("Camera lost, stopping VideoStream")
                            self._running.clear()
                            return
                        consecutive_failures = 0
                    else:
                        time.sleep(interval)
                    continue

                consecutive_failures = 0
                success, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if not success or buffer is None:
                    logging.warning("Failed to encode frame as JPEG")
                    continue
                b64_frame = base64.b64encode(buffer).decode("utf-8")

                try:
                    loop.run_until_complete(self.frame_callback(b64_frame))
                except Exception as e:
                    logging.error(f"Error in frame callback: {e}")

                for cb in self._frame_callbacks:
                    try:
                        cb(b64_frame)
                    except Exception as e:
                        logging.error(f"Error in additional frame callback: {e}")

                elapsed = time.time() - start
                sleep_time = max(0, interval - elapsed)
                if sleep_time > 0:
                    time.sleep(sleep_time)
        finally:
            if cap is not None:
                cap.release()
            loop.close()
