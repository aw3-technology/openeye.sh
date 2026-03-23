from .event_bus import EventBus
from .io_provider import IOProvider
from .telemetry_provider import TelemetryProvider


class Providers:
    """
    Convenience container for the core singleton providers.

    Eliminates the 3-line boilerplate that was duplicated in 16+ files:
        self.io_provider = IOProvider()
        self.event_bus = EventBus()
        self.telemetry = TelemetryProvider()

    Usage:
        p = Providers()
        p.io        # IOProvider singleton
        p.events    # EventBus singleton
        p.telemetry # TelemetryProvider singleton
    """

    __slots__ = ("io", "events", "telemetry")

    def __init__(self):
        self.io: IOProvider = IOProvider()
        self.events: EventBus = EventBus()
        self.telemetry: TelemetryProvider = TelemetryProvider()


__all__ = [
    "EventBus",
    "IOProvider",
    "Providers",
    "TelemetryProvider",
]
