"""Shared fixtures for backend tests."""

import os

import pytest

# The fleet control plane starts a background offline-device sweeper in its
# lifespan; keep it off in tests unless a test opts in explicitly.
os.environ.setdefault("FLEET_OFFLINE_SWEEP_INTERVAL", "0")

# Import torch (when installed) before any test stubs modules in sys.modules;
# torch's first import inspects source files and breaks on a MagicMock module.
try:
    import torch  # noqa: F401
except ImportError:
    pass


@pytest.fixture(autouse=True)
def reset_singletons():
    """Reset all singleton providers between tests."""
    from providers.io_provider import IOProvider
    from providers.sleep_ticker_provider import SleepTickerProvider

    yield
    IOProvider.reset()
    SleepTickerProvider.reset()


@pytest.fixture()
def io_provider():
    """Return a fresh IOProvider instance."""
    from providers.io_provider import IOProvider

    return IOProvider()


@pytest.fixture()
def sleep_ticker():
    """Return a fresh SleepTickerProvider instance."""
    from providers.sleep_ticker_provider import SleepTickerProvider

    return SleepTickerProvider()
