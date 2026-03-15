"""Nebius Token Factory embedding client — Qwen3-Embedding via OpenAI-compatible API."""

import logging
from typing import Optional

import numpy as np
import openai

from .base_embedding import BaseEmbeddingClient

NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/"
DEFAULT_MODEL = "Qwen/Qwen3-Embedding-8B"
DEFAULT_DIMENSIONS = 4096


class NebiusEmbeddingClient(BaseEmbeddingClient):
    """Embedding client using Nebius Token Factory's ``/v1/embeddings`` endpoint.

    Default model is Qwen3-Embedding-8B which produces 4096-dimensional vectors.

    Note: existing FAISS indexes built with 384-dim e5-small-v2 are incompatible.
    New indexes must be built when switching to this embedding provider.
    """

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        base_url: Optional[str] = None,
        dimensions: int = DEFAULT_DIMENSIONS,
    ):
        super().__init__()
        self._client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url=base_url or NEBIUS_BASE_URL,
        )
        self._model = model
        self._dimensions = dimensions

    async def embed(self, query: str) -> np.ndarray:
        """Embed a single query string.

        Parameters
        ----------
        query : str
            Text to embed.

        Returns
        -------
        np.ndarray
            Embedding vector of shape ``(dimensions,)``.
        """
        response = await self._client.embeddings.create(
            model=self._model,
            input=query,
        )
        embedding = np.array(response.data[0].embedding, dtype=np.float32)
        logging.debug(f"Nebius embed: len={len(query)}, dim={embedding.shape[0]}")
        return embedding

    async def embed_batch(self, queries: list[str]) -> np.ndarray:
        """Embed multiple query strings in a single batch.

        Parameters
        ----------
        queries : list of str
            List of texts to embed.

        Returns
        -------
        np.ndarray
            Embedding matrix of shape ``(len(queries), dimensions)``.
        """
        response = await self._client.embeddings.create(
            model=self._model,
            input=queries,
        )
        # API may return embeddings out of order; sort by index
        sorted_data = sorted(response.data, key=lambda d: d.index)
        matrix = np.array(
            [d.embedding for d in sorted_data], dtype=np.float32
        )
        logging.debug(f"Nebius embed_batch: n={len(queries)}, shape={matrix.shape}")
        return matrix
