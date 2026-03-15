"""Schemas for A/B testing (story 184)."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field, model_validator

from .enums import ABTestStatus

class ABTestConfig(BaseModel):
    """Configuration for an A/B test between two model versions."""

    name: str
    model_key: str
    version_a: str = Field(description="Control version")
    version_b: str = Field(description="Challenger version")
    traffic_split: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Fraction of traffic to version B"
    )
    max_samples: int | None = Field(default=None, description="Stop after N samples")
    duration_hours: float | None = Field(default=None, description="Stop after N hours")

    @model_validator(mode="after")
    def _versions_differ(self):
        if self.version_a == self.version_b:
            raise ValueError("version_a and version_b must be different")
        return self

class ABTestMetrics(BaseModel):
    """Aggregated metrics for one side of an A/B test."""

    version: str
    samples: int = 0
    mean_accuracy: float = 0.0
    mean_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    error_rate: float = 0.0
    custom_metrics: dict[str, float] = Field(default_factory=dict)

class ABTestResult(BaseModel):
    """Full A/B test state and results."""

    id: str
    config: ABTestConfig
    status: ABTestStatus = ABTestStatus.RUNNING
    metrics_a: ABTestMetrics = Field(default_factory=lambda: ABTestMetrics(version=""))
    metrics_b: ABTestMetrics = Field(default_factory=lambda: ABTestMetrics(version=""))
    winner: str | None = None
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: str | None = None
