"""Inference queue with concurrency control."""

from __future__ import annotations

import asyncio
from typing import Any, Callable, TypeVar

T = TypeVar("T")


class QueueFullError(Exception):
    """Raised when the inference queue is at capacity."""


class InferenceQueue:
    """Serializes inference requests with bounded concurrency."""

    def __init__(self, max_concurrent: int = 1, max_queue_size: int = 16):
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._max_queue_size = max_queue_size
        self._queue_size = 0
        self._active_count = 0
        self._lock = asyncio.Lock()

    @property
    def queue_size(self) -> int:
        return self._queue_size

    @property
    def active_count(self) -> int:
        return self._active_count

    @property
    def max_queue_size(self) -> int:
        return self._max_queue_size

    async def submit(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """Submit a callable for execution with concurrency control.

        Raises QueueFullError if the queue is at capacity.
        """
        async with self._lock:
            if self._queue_size >= self._max_queue_size:
                raise QueueFullError(
                    f"Inference queue full ({self._max_queue_size} pending)"
                )
            self._queue_size += 1

        acquired = False
        try:
            await self._semaphore.acquire()
            acquired = True
            async with self._lock:
                self._queue_size -= 1
                self._active_count += 1
            try:
                if asyncio.iscoroutinefunction(fn):
                    return await fn(*args, **kwargs)
                return fn(*args, **kwargs)
            finally:
                async with self._lock:
                    self._active_count -= 1
        except BaseException:
            if not acquired:
                # Only decrement queue if we never acquired the semaphore
                async with self._lock:
                    if self._queue_size > 0:
                        self._queue_size -= 1
            raise
        finally:
            if acquired:
                self._semaphore.release()
