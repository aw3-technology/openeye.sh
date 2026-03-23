import asyncio
import logging
import time
from typing import List, Optional

import cv2


RESOLUTIONS = [
    (3840, 2160),
    (2560, 1440),
    (1920, 1080),
    (1280, 720),
    (1024, 576),
    (800, 600),
    (640, 480),
]


def set_best_resolution(cap: cv2.VideoCapture, resolutions: List[tuple]) -> tuple:
    for width, height in resolutions:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        time.sleep(0.1)
        actual_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if actual_width == width and actual_height == height:
            logging.info(f"Resolution set to: {width}x{height}")
            return width, height
    logging.info("Could not set preferred resolution. Using default.")
    return int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))


def check_webcam(index_to_check):
    cap = cv2.VideoCapture(index_to_check)
    if not cap.isOpened():
        logging.error(f"YOLO did not find cam: {index_to_check}")
        cap.release()
        return 0, 0
    width, height = set_best_resolution(cap, RESOLUTIONS)
    logging.info(f"YOLO found cam: {index_to_check} set to {width}x{height}")
    cap.release()
    return width, height


class CameraManager:
    """Manages camera lifecycle: open, read, reconnect."""

    def __init__(self, camera_index: int, reconnect_attempts: int = 5, reconnect_delay: float = 2.0,
                 telemetry=None, event_bus=None):
        self.camera_index = camera_index
        self.reconnect_attempts = reconnect_attempts
        self.reconnect_delay = reconnect_delay
        self.telemetry = telemetry
        self.event_bus = event_bus

        self.width, self.height = check_webcam(self.camera_index)
        self.have_cam = self.width > 0
        self.cam_third = int(self.width / 3) if self.width > 0 else 0
        self.cap: Optional[cv2.VideoCapture] = None
        self._camera_disconnected = False

        if self.have_cam:
            self._open_camera()

    def _open_camera(self) -> bool:
        """Open the camera capture device."""
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            if not self.cap.isOpened():
                logging.error(f"Failed to open camera {self.camera_index}")
                self.have_cam = False
                return False
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
            self.cam_third = int(self.width / 3)
            self.have_cam = True
            self._camera_disconnected = False
            logging.info(f"Camera {self.camera_index} opened: {self.width}x{self.height}")
            return True
        except Exception as e:
            logging.error(f"Error opening camera: {e}")
            if self.telemetry:
                self.telemetry.record_error("camera", "open_failed", str(e))
            self.have_cam = False
            return False

    async def _reconnect_camera(self) -> bool:
        """Attempt to reconnect to the camera with retries."""
        max_attempts = self.reconnect_attempts
        delay = self.reconnect_delay

        logging.warning(
            f"Camera {self.camera_index} disconnected, attempting reconnect "
            f"(max {max_attempts} attempts, {delay}s delay)"
        )
        if self.event_bus:
            from providers.event_bus import EventType, PerceptionEvent
            self.event_bus.publish(
                PerceptionEvent(
                    event_type=EventType.CAMERA_STATUS,
                    source="VLM_Local_YOLO",
                    data={"status": "disconnected", "camera_index": self.camera_index},
                )
            )

        for attempt in range(1, max_attempts + 1):
            await asyncio.sleep(delay)
            logging.info(f"Reconnect attempt {attempt}/{max_attempts}...")

            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception as exc:
                    logging.debug("Error releasing camera during reconnect: %s", exc)

            if self._open_camera():
                if self.telemetry:
                    self.telemetry.record_camera_reconnect()
                if self.event_bus:
                    from providers.event_bus import EventType, PerceptionEvent
                    self.event_bus.publish(
                        PerceptionEvent(
                            event_type=EventType.CAMERA_STATUS,
                            source="VLM_Local_YOLO",
                            data={
                                "status": "reconnected",
                                "camera_index": self.camera_index,
                                "attempt": attempt,
                            },
                        )
                    )
                logging.info(f"Camera reconnected on attempt {attempt}")
                return True

        logging.error(f"Failed to reconnect camera after {max_attempts} attempts")
        if self.telemetry:
            self.telemetry.record_error(
                "camera", "reconnect_failed", f"Failed after {max_attempts} attempts"
            )
        self._camera_disconnected = True
        return False

    def stop(self):
        """Release the camera."""
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception as exc:
                logging.debug("Error releasing camera: %s", exc)
            self.cap = None
        self.have_cam = False
