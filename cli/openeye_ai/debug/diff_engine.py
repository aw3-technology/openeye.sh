"""Pixel-level diff engine for visual regression detection."""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class PixelDiffEngine:
    """Fast pixel-level comparison between two screenshots."""

    def compute_diff(self, before, after) -> dict[str, Any]:
        """Compute pixel diff percentage and SSIM between two PIL images.

        Returns dict with:
            pixel_diff_pct: percentage of pixels that differ (0-100)
            ssim: structural similarity index (0-1, 1 = identical)
        """
        # Resize to same dimensions if needed
        if before.size != after.size:
            after = after.resize(before.size)

        arr_before = np.array(before.convert("RGB"))
        arr_after = np.array(after.convert("RGB"))

        # Pixel diff percentage
        diff = np.abs(arr_before.astype(float) - arr_after.astype(float))
        # Consider a pixel "changed" if any channel differs by > 10
        changed_pixels = np.any(diff > 10, axis=2)
        total_pixels = changed_pixels.size
        pixel_diff_pct = (np.sum(changed_pixels) / total_pixels) * 100

        # SSIM
        ssim_score = self._compute_ssim(arr_before, arr_after)

        return {
            "pixel_diff_pct": float(pixel_diff_pct),
            "ssim": float(ssim_score),
        }

    def highlight_changes(self, before, after):
        """Generate a diff image highlighting changed regions.

        Returns a PIL Image with changed areas highlighted in red.
        """
        from PIL import Image

        if before.size != after.size:
            after = after.resize(before.size)

        arr_before = np.array(before.convert("RGB"))
        arr_after = np.array(after.convert("RGB"))

        diff = np.abs(arr_before.astype(float) - arr_after.astype(float))
        changed = np.any(diff > 10, axis=2)

        # Create highlight overlay
        highlight = arr_after.copy()
        highlight[changed] = [255, 0, 0]  # Red overlay on changed pixels

        # Blend: 60% original + 40% highlight
        blended = (arr_after * 0.6 + highlight * 0.4).astype(np.uint8)

        return Image.fromarray(blended)

    def _compute_ssim(self, img1: np.ndarray, img2: np.ndarray) -> float:
        """Compute SSIM using scikit-image if available, else a simplified version."""
        try:
            from skimage.metrics import structural_similarity

            # Convert to grayscale for SSIM
            gray1 = np.mean(img1, axis=2)
            gray2 = np.mean(img2, axis=2)
            return float(structural_similarity(gray1, gray2, data_range=255))
        except ImportError:
            # Simplified SSIM approximation
            gray1 = np.mean(img1, axis=2).astype(float)
            gray2 = np.mean(img2, axis=2).astype(float)

            mu1 = np.mean(gray1)
            mu2 = np.mean(gray2)
            sigma1_sq = np.var(gray1)
            sigma2_sq = np.var(gray2)
            sigma12 = np.mean((gray1 - mu1) * (gray2 - mu2))

            c1 = (0.01 * 255) ** 2
            c2 = (0.03 * 255) ** 2

            ssim = ((2 * mu1 * mu2 + c1) * (2 * sigma12 + c2)) / (
                (mu1**2 + mu2**2 + c1) * (sigma1_sq + sigma2_sq + c2)
            )
            return float(ssim)
