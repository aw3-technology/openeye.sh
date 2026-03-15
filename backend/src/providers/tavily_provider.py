"""Tavily provider — wraps TavilyClient for safety information search."""

import logging
import os

from tavily import TavilyClient


class TavilyProvider:
    def __init__(self, api_key: str | None = None):
        key = api_key or os.getenv("TAVILY_API_KEY")
        if not key:
            raise ValueError("TAVILY_API_KEY not set")
        self._client = TavilyClient(api_key=key)

    def search_safety_info(self, object_description: str) -> str:
        """Search for safety information about a detected object or scene.

        Parameters
        ----------
        object_description : str
            Description of the object or scene to search safety info for.

        Returns
        -------
        str
            Aggregated safety information from search results.
        """
        query = f"safety hazards risks {object_description} workplace robot"
        try:
            results = self._client.search(query, max_results=3)
            contents = []
            for result in results.get("results", []):
                title = result.get("title", "")
                content = result.get("content", "")
                contents.append(f"{title}: {content}")
            return "\n".join(contents) if contents else "No safety information found."
        except Exception as e:
            logging.error(f"Tavily search error: {e}")
            return f"Safety search failed: {e}"
