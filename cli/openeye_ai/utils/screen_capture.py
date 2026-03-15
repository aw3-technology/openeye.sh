"""Screen and browser capture utilities — same read_pil() interface as Camera/VideoPlayer."""

from __future__ import annotations

import logging
import time
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)

class ScreenCapture:
    """Capture a screen region using mss. Implements read_pil()/release() interface.

    Parameters
    ----------
    monitor : int
        Monitor index (0 = all monitors combined, 1 = primary, 2+ = others).
    region : tuple[int, int, int, int] | None
        Optional (left, top, width, height) pixel region to capture.
    max_fps : float
        Maximum captures per second.  ``read_pil`` returns ``None`` when
        called faster than this rate so the caller can simply loop.
    scale : float
        Down-scale factor applied to the captured image (1.0 = no scaling).
    """

    def __init__(
        self,
        monitor: int = 1,
        region: tuple[int, int, int, int] | None = None,
        max_fps: float = 5.0,
        scale: float = 1.0,
    ) -> None:
        self._monitor = monitor
        self._region = region
        self._min_interval = 1.0 / max_fps if max_fps > 0 else 0.0
        self._scale = scale
        self._last_capture: float = 0.0
        self._sct: Any = None  # lazy mss instance

    def _get_sct(self) -> Any:
        if self._sct is None:
            import mss

            self._sct = mss.mss()
        return self._sct

    def _monitor_spec(self) -> dict[str, int]:
        """Return the mss monitor dict, optionally cropped to a region."""
        sct = self._get_sct()
        if self._region:
            left, top, w, h = self._region
            return {"left": left, "top": top, "width": w, "height": h}
        return sct.monitors[self._monitor]

    def read_pil(self) -> Image.Image | None:
        """Capture screen region and return as PIL RGB Image, or None on failure.

        Returns ``None`` if called faster than *max_fps* (throttle) or on
        capture failure.
        """
        now = time.monotonic()
        if (now - self._last_capture) < self._min_interval:
            return None

        try:
            sct = self._get_sct()
            grab = sct.grab(self._monitor_spec())
            img = Image.frombytes("RGB", grab.size, grab.bgra, "raw", "BGRX")

            if self._scale != 1.0:
                new_w = int(img.width * self._scale)
                new_h = int(img.height * self._scale)
                img = img.resize((new_w, new_h), Image.LANCZOS)

            self._last_capture = now
            return img
        except Exception as e:
            logger.error("Screen capture failed: %s", e)
            return None

    def release(self) -> None:
        """Clean up mss resources."""
        if self._sct is not None:
            try:
                self._sct.close()
            except Exception:
                pass
            self._sct = None

class BrowserCapture:
    """Capture screenshots from a URL using Playwright. Implements read_pil()/release() interface."""

    def __init__(self, url: str, width: int = 1280, height: int = 720) -> None:
        self._url = url
        self._width = width
        self._height = height
        self._playwright = None
        self._browser = None
        self._page = None

    def _ensure_browser(self) -> None:
        """Lazy-initialize Playwright browser."""
        if self._page is not None:
            return

        from playwright.sync_api import sync_playwright

        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=True)
        self._page = self._browser.new_page(
            viewport={"width": self._width, "height": self._height}
        )
        self._page.goto(self._url, wait_until="networkidle", timeout=30000)

    def read_pil(self):
        """Capture page screenshot and return as PIL Image, or None on failure."""
        import io

        try:
            self._ensure_browser()
            screenshot_bytes = self._page.screenshot(type="png")
            return Image.open(io.BytesIO(screenshot_bytes)).convert("RGB")
        except Exception as e:
            logger.error("Browser capture failed: %s", e)
            return None

    def reload(self) -> None:
        """Reload the current page (useful for watch mode)."""
        if self._page:
            self._page.reload(wait_until="networkidle", timeout=15000)

    def release(self) -> None:
        """Clean up Playwright resources."""
        try:
            if self._browser:
                self._browser.close()
            if self._playwright:
                self._playwright.stop()
        except Exception:
            pass
        self._page = None
        self._browser = None
        self._playwright = None
