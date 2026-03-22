"""Nebius / OpenRouter VLM caller for the agentic loop."""

from __future__ import annotations

import asyncio
import os
from typing import Callable


def _resolve_provider() -> tuple[str, str, str]:
    """Resolve VLM provider config: (api_key, base_url, model).

    Mirrors ServerState.resolve_vlm_model() logic.
    Auto-detects OpenRouter vs Nebius from the model ID format.
    """
    model = os.environ.get("NEBIUS_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct")

    # OpenRouter model IDs use lowercase org/model or contain ":free"
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


def create_async_vlm_client(
    api_key: str,
    base_url: str,
    model: str,
) -> tuple[object | None, str]:
    """Create an async OpenAI-compatible VLM client.

    Returns ``(client, model)`` on success or ``(None, model)`` if the
    ``openai`` package is not installed.  This consolidates the duplicated
    client-init blocks from ``/ws/vlm`` and ``/ws/agentic``.
    """
    if not api_key:
        return None, model
    try:
        from openai import AsyncOpenAI

        return AsyncOpenAI(base_url=base_url, api_key=api_key), model
    except ImportError:
        import logging

        logging.getLogger(__name__).warning(
            "openai package not installed — VLM client unavailable"
        )
        return None, model


def create_vlm_caller(max_tokens: int = 400) -> Callable[[str], str]:
    """Create a sync callable that sends a prompt to a VLM and returns the response.

    Returns a ``Callable[[str], str]`` compatible with ``AgentLoop(llm_call=...)``.

    Raises
    ------
    ImportError
        If the ``openai`` package is not installed.
    RuntimeError
        If no API key is configured.
    """
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise ImportError(
            "VLM support requires the 'openai' package. "
            "Install it with: pip install 'openeye-sh[vlm]'  or  pip install openai"
        )

    api_key, base_url, model = _resolve_provider()

    if not api_key:
        provider = "OPENROUTER_API_KEY" if "openrouter" in base_url else "NEBIUS_API_KEY"
        raise RuntimeError(
            f"No API key found. Set the {provider} environment variable."
        )

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    async def _call_async(prompt: str) -> str:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    def vlm_call(prompt: str) -> str:
        """Synchronous wrapper around the async OpenAI call."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # Already inside an event loop — run in a new thread
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, _call_async(prompt))
                return future.result()
        else:
            return asyncio.run(_call_async(prompt))

    return vlm_call
