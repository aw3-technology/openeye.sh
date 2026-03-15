"""Core UI debug analyzer — VLM-powered screenshot analysis."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Pydantic output models ──────────────────────────────────────────

class UIIssueBBox(BaseModel):
    x: float = 0.0
    y: float = 0.0
    w: float = 0.0
    h: float = 0.0

class UIIssue(BaseModel):
    type: str = "visual"  # layout|accessibility|typography|visual|responsive|state
    severity: str = "info"  # critical|warning|info
    description: str = ""
    bbox: UIIssueBBox = Field(default_factory=UIIssueBBox)
    suggestion: str = ""
    wcag_criterion: str | None = None

class DebugAnalysis(BaseModel):
    issues: list[UIIssue] = Field(default_factory=list)
    summary: str = ""
    overall_score: int = 100
    categories: dict[str, int] = Field(default_factory=dict)
    analysis_ms: float = 0.0
    model: str = ""

class DiffChange(BaseModel):
    type: str = "ambiguous"  # regression|intentional|ambiguous
    severity: str = "info"
    description: str = ""
    bbox: UIIssueBBox = Field(default_factory=UIIssueBBox)
    suggestion: str = ""

class DiffResult(BaseModel):
    changes: list[DiffChange] = Field(default_factory=list)
    regression_detected: bool = False
    summary: str = ""
    pixel_diff_pct: float = 0.0
    ssim: float = 1.0
    analysis_ms: float = 0.0
    model: str = ""

# ── VLM resolution (mirrors server/app.py logic) ────────────────────

def _resolve_vlm() -> tuple[str, str, str]:
    """Resolve VLM provider: (api_key, base_url, model)."""
    model = os.environ.get("NEBIUS_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct")

    is_openrouter = "/" in model and (
        model.split("/")[0].islower() or ":free" in model
    )

    if is_openrouter:
        api_key = os.environ.get("OPENROUTER_API_KEY", "")
        base_url = "https://openrouter.ai/api/v1"
    else:
        api_key = os.environ.get("NEBIUS_API_KEY", "")
        base_url = os.environ.get(
            "NEBIUS_BASE_URL", "https://api.studio.nebius.com/v1"
        )

    return api_key, base_url, model

def _image_to_base64(img) -> str:
    """Convert PIL Image to base64 JPEG string."""
    import io
    import base64

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()

def _parse_json_response(text: str) -> dict[str, Any]:
    """Extract JSON from VLM response, tolerating markdown fences."""
    text = text.strip()
    if text.startswith("```"):
        # Strip markdown code fences
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        return {}

# ── Main analyzer class ─────────────────────────────────────────────

class UIDebugAnalyzer:
    """Analyzes UI screenshots using VLM for issue detection."""

    def __init__(self, vlm_model: str | None = None) -> None:
        api_key, base_url, model = _resolve_vlm()
        if vlm_model:
            model = vlm_model
        self._api_key = api_key
        self._base_url = base_url
        self._model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import openai

            self._client = openai.AsyncOpenAI(
                base_url=self._base_url, api_key=self._api_key
            )
        return self._client

    async def analyze_screenshot(self, image) -> DebugAnalysis:
        """Analyze a single screenshot for UI issues."""
        from openeye_ai.debug.prompts import SCREENSHOT_ANALYSIS_PROMPT

        if not self._api_key:
            return DebugAnalysis(
                summary="VLM not configured (missing NEBIUS_API_KEY or OPENROUTER_API_KEY).",
                model=self._model,
            )

        b64 = _image_to_base64(image)
        client = self._get_client()

        t0 = time.time()
        try:
            import asyncio

            resp = await asyncio.wait_for(
                client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": SCREENSHOT_ANALYSIS_PROMPT},
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{b64}"
                                    },
                                },
                                {
                                    "type": "text",
                                    "text": "Analyze this UI screenshot for issues.",
                                },
                            ],
                        },
                    ],
                    max_tokens=1500,
                ),
                timeout=30.0,
            )
            latency = (time.time() - t0) * 1000
            content = resp.choices[0].message.content or ""
            data = _parse_json_response(content)

            issues = [UIIssue(**i) for i in data.get("issues", [])]
            return DebugAnalysis(
                issues=issues,
                summary=data.get("summary", ""),
                overall_score=data.get("overall_score", 100),
                categories=data.get("categories", {}),
                analysis_ms=round(latency, 1),
                model=self._model,
            )
        except Exception as e:
            latency = (time.time() - t0) * 1000
            logger.error("VLM analysis failed: %s", e)
            return DebugAnalysis(
                summary=f"Analysis failed: {e}",
                analysis_ms=round(latency, 1),
                model=self._model,
            )

    async def diff_screenshots(self, before, after) -> DiffResult:
        """Compare before/after screenshots for visual regressions."""
        from openeye_ai.debug.prompts import DIFF_ANALYSIS_PROMPT

        if not self._api_key:
            return DiffResult(
                summary="VLM not configured.",
                model=self._model,
            )

        b64_before = _image_to_base64(before)
        b64_after = _image_to_base64(after)
        client = self._get_client()

        t0 = time.time()
        try:
            import asyncio

            resp = await asyncio.wait_for(
                client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": DIFF_ANALYSIS_PROMPT},
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "BEFORE screenshot:",
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{b64_before}"
                                    },
                                },
                                {
                                    "type": "text",
                                    "text": "AFTER screenshot:",
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{b64_after}"
                                    },
                                },
                            ],
                        },
                    ],
                    max_tokens=1500,
                ),
                timeout=30.0,
            )
            latency = (time.time() - t0) * 1000
            content = resp.choices[0].message.content or ""
            data = _parse_json_response(content)

            changes = [DiffChange(**c) for c in data.get("changes", [])]
            return DiffResult(
                changes=changes,
                regression_detected=data.get("regression_detected", False),
                summary=data.get("summary", ""),
                analysis_ms=round(latency, 1),
                model=self._model,
            )
        except Exception as e:
            latency = (time.time() - t0) * 1000
            logger.error("VLM diff failed: %s", e)
            return DiffResult(
                summary=f"Diff analysis failed: {e}",
                analysis_ms=round(latency, 1),
                model=self._model,
            )

    async def analyze_live_frame(
        self, image, frame_number: int, interval: float, change_context: str = ""
    ) -> DebugAnalysis:
        """Analyze a live frame during watch mode."""
        from openeye_ai.debug.prompts import LIVE_WATCH_PROMPT

        if not self._api_key:
            return DebugAnalysis(
                summary="VLM not configured.", model=self._model
            )

        prompt = LIVE_WATCH_PROMPT.format(
            frame_number=frame_number,
            interval=interval,
            change_context=change_context or "No prior context.",
        )

        b64 = _image_to_base64(image)
        client = self._get_client()

        t0 = time.time()
        try:
            import asyncio

            resp = await asyncio.wait_for(
                client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": prompt},
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{b64}"
                                    },
                                },
                                {
                                    "type": "text",
                                    "text": "Analyze this live UI frame.",
                                },
                            ],
                        },
                    ],
                    max_tokens=1000,
                ),
                timeout=15.0,
            )
            latency = (time.time() - t0) * 1000
            content = resp.choices[0].message.content or ""
            data = _parse_json_response(content)

            issues = [UIIssue(**i) for i in data.get("issues", [])]
            return DebugAnalysis(
                issues=issues,
                summary=data.get("summary", ""),
                overall_score=data.get("overall_score", 100),
                categories=data.get("categories", {}),
                analysis_ms=round(latency, 1),
                model=self._model,
            )
        except Exception as e:
            latency = (time.time() - t0) * 1000
            logger.error("Live analysis failed: %s", e)
            return DebugAnalysis(
                summary=f"Live analysis failed: {e}",
                analysis_ms=round(latency, 1),
                model=self._model,
            )
