"""Tests for the Providers convenience container."""

import pytest

from providers import Providers
from providers.event_bus import EventBus
from providers.io_provider import IOProvider
from providers.telemetry_provider import TelemetryProvider


@pytest.fixture(autouse=True)
def _reset():
    """Reset singletons between tests."""
    yield
    IOProvider.reset()
    EventBus.reset()
    TelemetryProvider.reset()


class TestProviders:
    def test_exposes_all_three_singletons(self):
        p = Providers()
        assert isinstance(p.io, IOProvider._singleton_class)
        assert isinstance(p.events, EventBus._singleton_class)
        assert isinstance(p.telemetry, TelemetryProvider._singleton_class)

    def test_returns_same_instances_as_direct_call(self):
        p = Providers()
        assert p.io is IOProvider()
        assert p.events is EventBus()
        assert p.telemetry is TelemetryProvider()

    def test_multiple_providers_share_singletons(self):
        p1 = Providers()
        p2 = Providers()
        assert p1.io is p2.io
        assert p1.events is p2.events
        assert p1.telemetry is p2.telemetry
