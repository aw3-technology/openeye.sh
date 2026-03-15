"""Rate limiting configuration for the OpenEye server."""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# Default rate limits
DEFAULT_LIMIT = "60/minute"
PREDICT_LIMIT = "30/minute"

limiter = Limiter(key_func=get_remote_address)
