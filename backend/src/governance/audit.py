"""Audit log for governance decisions."""

from __future__ import annotations

import logging
import time
from collections import deque

from governance.models import (
    AuditEntry,
    GovernanceResult,
    GovernanceVerdict,
    PolicyDecision,
)

logger = logging.getLogger(__name__)


class AuditLog:
    """In-memory audit trail with configurable retention.

    Stores structured entries for every governance evaluation (or only
    violations/warnings when ``log_all`` is False).
    """

    def __init__(self, max_entries: int = 10_000, log_all: bool = True) -> None:
        self._entries: deque[AuditEntry] = deque(maxlen=max_entries)
        self.log_all = log_all
        self.total_evaluations = 0
        self.total_violations = 0
        self.total_warnings = 0

    def record_verdict(self, verdict: GovernanceVerdict, frame_id: int | None = None) -> None:
        """Record all results from a governance verdict."""
        self.total_evaluations += 1
        self.total_violations += len(verdict.violations)
        self.total_warnings += len(verdict.warnings)

        for result in verdict.results:
            if not self.log_all and result.decision == PolicyDecision.ALLOW:
                continue
            self._entries.append(
                AuditEntry(
                    timestamp=time.time(),
                    frame_id=frame_id,
                    policy_name=result.policy_name,
                    decision=result.decision,
                    reason=result.reason,
                    severity=result.severity,
                    affected_objects=result.affected_objects,
                    metadata=result.metadata,
                )
            )

    def record_result(self, result: GovernanceResult, frame_id: int | None = None) -> None:
        """Record a single governance result."""
        self._entries.append(
            AuditEntry(
                timestamp=time.time(),
                frame_id=frame_id,
                policy_name=result.policy_name,
                decision=result.decision,
                reason=result.reason,
                severity=result.severity,
                affected_objects=result.affected_objects,
                metadata=result.metadata,
            )
        )

    def get_entries(self, limit: int = 100, offset: int = 0) -> list[AuditEntry]:
        """Return recent entries (newest first)."""
        entries = list(reversed(self._entries))
        return entries[offset : offset + limit]

    def get_violations(self, limit: int = 50) -> list[AuditEntry]:
        """Return recent violation entries."""
        violations = [
            e for e in reversed(self._entries) if e.decision == PolicyDecision.DENY
        ]
        return violations[:limit]

    def get_warnings(self, limit: int = 50) -> list[AuditEntry]:
        """Return recent warning entries."""
        warnings = [
            e for e in reversed(self._entries) if e.decision == PolicyDecision.WARN
        ]
        return warnings[:limit]

    def clear(self) -> None:
        self._entries.clear()
        self.total_evaluations = 0
        self.total_violations = 0
        self.total_warnings = 0

    @property
    def size(self) -> int:
        return len(self._entries)
