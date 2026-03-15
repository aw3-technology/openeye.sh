"""Shared fixtures for backend tests."""

import pytest


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
