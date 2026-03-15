"""Prometheus metrics for the OpenEye inference server."""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram, Info

REQUEST_COUNT = Counter(
    "openeye_requests_total",
    "Total number of requests",
    ["method", "endpoint", "status"],
)

REQUEST_LATENCY = Histogram(
    "openeye_request_duration_seconds",
    "Request latency in seconds",
    ["method", "endpoint"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

INFERENCE_LATENCY = Histogram(
    "openeye_inference_duration_seconds",
    "Model inference latency in seconds",
    ["model"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

MODEL_INFO = Info(
    "openeye_model",
    "Information about the loaded model",
)

ACTIVE_CONNECTIONS = Gauge(
    "openeye_active_websocket_connections",
    "Number of active WebSocket connections",
)
