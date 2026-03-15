"""Token-bucket rate limiter for throttled downloads."""

import time
from typing import Iterator


class BandwidthLimiter:
    """Token-bucket algorithm for limiting download bandwidth.

    Args:
        rate_mbps: Maximum bandwidth in megabits per second. 0 = unlimited.
        chunk_size: Read chunk size in bytes (default 64KB).
    """

    def __init__(self, rate_mbps: float = 0, chunk_size: int = 65536):
        self.chunk_size = max(1, chunk_size)
        rate_mbps = max(0.0, rate_mbps or 0.0)
        if rate_mbps > 0:
            self._bytes_per_second = rate_mbps * 1_000_000 / 8
        else:
            self._bytes_per_second = 0  # unlimited
        self._tokens = 0.0
        self._last_time = time.monotonic()

    def throttled_read(self, data: bytes) -> Iterator[bytes]:
        """Yield data in rate-limited chunks."""
        if self._bytes_per_second <= 0:
            yield data
            return

        offset = 0
        while offset < len(data):
            chunk = data[offset : offset + self.chunk_size]
            self._consume(len(chunk))
            yield chunk
            offset += len(chunk)

    def _consume(self, nbytes: int) -> None:
        """Wait until enough tokens are available, then consume them."""
        if self._bytes_per_second <= 0:
            return

        now = time.monotonic()
        elapsed = now - self._last_time
        self._last_time = now
        self._tokens += elapsed * self._bytes_per_second

        # Cap tokens to one second's worth (burst limit)
        self._tokens = min(self._tokens, self._bytes_per_second)

        if self._tokens < nbytes:
            wait = (nbytes - self._tokens) / self._bytes_per_second
            time.sleep(wait)
            self._tokens = 0
        else:
            self._tokens -= nbytes
