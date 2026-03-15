"""Nebius safety guard — content moderation via Llama Guard 3 on Token Factory."""

import logging
from typing import Any, Dict, Optional

import openai

NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/"
DEFAULT_MODEL = "meta-llama/Llama-Guard-3-8B"


class NebiusSafetyGuard:
    """Content moderation using Llama Guard 3 via Nebius Token Factory.

    Llama Guard classifies content as ``safe`` or ``unsafe`` with category
    codes (e.g. S1, S10).  This class wraps the OpenAI-compatible chat
    endpoint to provide a simple ``moderate()`` interface.
    """

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        base_url: Optional[str] = None,
    ):
        self._client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url=base_url or NEBIUS_BASE_URL,
        )
        self._model = model

    async def moderate(self, content: str) -> Dict[str, Any]:
        """Run Llama Guard moderation on *content*.

        Returns
        -------
        dict
            ``safe``  – bool indicating whether the content is safe.
            ``categories`` – list of category codes (empty when safe).
            ``raw`` – the raw model response text.
        """
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": "user", "content": content}],
                temperature=0,
                max_tokens=100,
            )

            raw = (response.choices[0].message.content or "").strip()
            return self._parse(raw)
        except Exception as e:
            logging.error(f"Nebius safety guard error: {e}")
            return {"safe": False, "categories": [], "raw": f"error: {e}"}

    @staticmethod
    def _parse(raw: str) -> Dict[str, Any]:
        """Parse Llama Guard output format.

        Llama Guard returns either:
          - ``safe``
          - ``unsafe\\nS1,S10``  (with one or more category codes)
        """
        lines = raw.strip().splitlines()
        verdict = lines[0].strip().lower() if lines else ""

        if verdict == "safe":
            return {"safe": True, "categories": [], "raw": raw}

        categories = []
        if len(lines) > 1:
            categories = [c.strip() for c in lines[1].split(",") if c.strip()]

        return {"safe": False, "categories": categories, "raw": raw}
