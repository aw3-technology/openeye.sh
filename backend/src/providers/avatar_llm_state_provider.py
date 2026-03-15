"""No-op stub for AvatarLLMState. Original requires avatar/Zenoh hardware."""

import functools
from typing import Any, Awaitable, Callable, Optional, TypeVar

T = TypeVar("T")


class AvatarLLMState:
    """No-op stub - trigger_thinking() is a passthrough decorator."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def trigger_thinking(
        cls, func: Optional[Callable[..., Awaitable[T]]] = None
    ) -> Any:
        def decorator(f: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
            @functools.wraps(f)
            async def wrapper(*args: Any, **kwargs: Any) -> T:
                return await f(*args, **kwargs)
            return wrapper

        if func is not None:
            return decorator(func)
        return decorator

    def stop(self) -> None:
        pass
