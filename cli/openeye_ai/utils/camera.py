"""OpenCV camera and video capture utilities."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


class Camera:
    """Thin wrapper around OpenCV VideoCapture."""

    def __init__(self, index: int = 0) -> None:
        import cv2

        self._cap = cv2.VideoCapture(index)
        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open camera {index}")

    def read_pil(self) -> Image.Image | None:
        """Read a frame and return as PIL RGB Image, or None on failure."""
        import cv2

        ret, frame = self._cap.read()
        if not ret:
            return None
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)

    def release(self) -> None:
        self._cap.release()


class VideoPlayer:
    """Read frames from a video file, looping when it reaches the end.

    Implements the same interface as ``Camera`` so it can be used as a
    drop-in fallback when no live camera is available.
    """

    def __init__(self, path: str | Path, *, loop: bool = True) -> None:
        import cv2

        self._path = Path(path)
        if not self._path.exists():
            raise FileNotFoundError(f"Video file not found: {self._path}")

        self._cap = cv2.VideoCapture(str(self._path))
        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open video file: {self._path}")

        self._loop = loop
        self._fps = self._cap.get(cv2.CAP_PROP_FPS) or 30.0
        self._frame_count = int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))

    @property
    def fps(self) -> float:
        return self._fps

    @property
    def frame_count(self) -> int:
        return self._frame_count

    def read_pil(self) -> Image.Image | None:
        """Read the next frame as a PIL RGB Image. Loops if configured."""
        import cv2

        ret, frame = self._cap.read()
        if not ret:
            if self._loop:
                self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self._cap.read()
                if not ret:
                    return None
            else:
                return None
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)

    def release(self) -> None:
        self._cap.release()
