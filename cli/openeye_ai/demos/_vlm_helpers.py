"""Helper utilities for the VLM OpenRouter demo."""

from __future__ import annotations

import base64
import io
import os
import time
from pathlib import Path


def _find_repo_root() -> Path:
    """Walk up from this file to find the repo root (contains src/)."""
    p = Path(__file__).resolve().parent
    for _ in range(8):
        if (p / "src").is_dir():
            return p
        p = p.parent
    return Path.cwd()


def _load_env() -> None:
    """Load .env from the repo root if python-dotenv is available."""
    env_file = _find_repo_root() / ".env"
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
        except ImportError:
            # Manual fallback — parse KEY=VALUE lines
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def _encode_image(path: Path, max_size: int = 1024) -> str:
    """Load an image, resize if needed, return base64 JPEG string."""
    from PIL import Image

    img = Image.open(path)
    if img.mode == "RGBA":
        img = img.convert("RGB")

    # Resize to keep API payload reasonable
    w, h = img.size
    if max(w, h) > max_size:
        ratio = max_size / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


async def _query_vlm(
    api_key: str,
    model: str,
    image_b64: str,
    prompt: str,
    *,
    base_url: str,
) -> tuple[str, float]:
    """Send image + prompt to OpenRouter and return (response_text, latency_s)."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        base_url=base_url,
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "https://perceptify.dev",
            "X-Title": "OpenEye",
        },
    )

    t0 = time.monotonic()
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}",
                            "detail": "low",
                        },
                    },
                ],
            }
        ],
        max_tokens=400,
    )
    elapsed = time.monotonic() - t0

    text = response.choices[0].message.content or "(empty response)"
    return text, elapsed
