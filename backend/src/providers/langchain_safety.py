"""LangChain safety chain — assesses scene safety risk from detections."""

import logging
from typing import Any, Dict, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI


_SAFETY_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a safety assessment AI for robotic systems. "
            "Given a scene description and detected objects, assess the safety risk. "
            "Respond with ONLY a JSON object: "
            '{{ "risk_level": <1-10>, "recommendation": "<CONTINUE|SLOW|HALT>", "reason": "<brief reason>" }}',
        ),
        (
            "user",
            "Scene: {scene_description}\n\nDetected objects: {detected_objects}",
        ),
    ]
)


class SafetyChain:
    """LangChain-based safety assessment using any OpenAI-compatible endpoint."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: Optional[str] = None,
    ):
        kwargs: Dict[str, Any] = {
            "api_key": api_key,
            "model": model,
            "temperature": 0,
            "max_tokens": 200,
        }
        if base_url:
            kwargs["base_url"] = base_url

        self._llm = ChatOpenAI(**kwargs)
        self._chain = _SAFETY_PROMPT | self._llm

    async def assess(
        self,
        scene_description: str,
        detected_objects: str,
    ) -> Dict[str, Any]:
        """Assess safety risk for a scene.

        Returns
        -------
        dict
            Contains risk_level (int 1-10), recommendation (str), reason (str).
        """
        import json

        try:
            result = await self._chain.ainvoke(
                {
                    "scene_description": scene_description,
                    "detected_objects": detected_objects,
                }
            )
            return json.loads(result.content)
        except Exception as e:
            logging.error(f"Safety chain error: {e}")
            return {
                "risk_level": 5,
                "recommendation": "SLOW",
                "reason": f"Safety assessment unavailable: {e}",
            }
