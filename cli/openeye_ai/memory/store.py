"""JSONL-backed observation memory store."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from openeye_ai.config import OPENEYE_HOME
from openeye_ai.schema import Observation, RecallQuery, RecallResult

DEFAULT_MEMORY_PATH = OPENEYE_HOME / "memory" / "observations.jsonl"

_TIME_RANGES = {
    "last_5m": timedelta(minutes=5),
    "last_15m": timedelta(minutes=15),
    "last_1h": timedelta(hours=1),
    "last_6h": timedelta(hours=6),
    "last_24h": timedelta(hours=24),
    "last_7d": timedelta(days=7),
}


class ObservationMemoryStore:
    """Append-only JSONL file for storing observations."""

    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path else DEFAULT_MEMORY_PATH
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def store(self, observation: Observation) -> None:
        """Append an observation to the JSONL file."""
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(observation.model_dump_json() + "\n")

    def _load_all(self) -> list[Observation]:
        """Load all observations from the file."""
        if not self.path.exists():
            return []
        observations = []
        for line in self.path.read_text().strip().splitlines():
            if line:
                observations.append(Observation.model_validate_json(line))
        return observations

    def recall(self, query: RecallQuery) -> RecallResult:
        """Filter observations by time range, significance, and keyword."""
        all_obs = self._load_all()
        filtered = all_obs

        # Time range filter
        if query.time_range and query.time_range in _TIME_RANGES:
            cutoff = datetime.now(timezone.utc) - _TIME_RANGES[query.time_range]
            cutoff_iso = cutoff.isoformat()
            filtered = [o for o in filtered if o.timestamp >= cutoff_iso]

        # Significance filter
        if query.significance_min > 0:
            filtered = [o for o in filtered if o.significance >= query.significance_min]

        # Keyword search on scene_summary, change_description, and tags
        if query.query:
            keywords = query.query.lower().split()
            def matches(obs: Observation) -> bool:
                text = f"{obs.scene_summary} {obs.change_description} {' '.join(obs.tags)}".lower()
                return any(kw in text for kw in keywords)
            filtered = [o for o in filtered if matches(o)]

        total = len(filtered)
        # Return most recent first, limited
        filtered = sorted(filtered, key=lambda o: o.timestamp, reverse=True)
        filtered = filtered[: query.limit]

        return RecallResult(observations=filtered, query=query.query, total_matches=total)

    def recall_recent(self, n: int = 5) -> list[Observation]:
        """Return the last N observations."""
        all_obs = self._load_all()
        return all_obs[-n:] if all_obs else []

    def summarize(self, observations: list[Observation]) -> str:
        """Compress observations into an LLM-context-friendly string."""
        if not observations:
            return "No prior observations."
        lines = []
        for obs in observations:
            det_str = ", ".join(
                f"{d.label}({d.confidence:.0%})" for d in obs.detections[:5]
            )
            line = f"[tick {obs.tick}] {obs.scene_summary}"
            if obs.change_description:
                line += f" | Change: {obs.change_description}"
            if det_str:
                line += f" | Objects: {det_str}"
            lines.append(line)
        return "\n".join(lines)

    def clear(self) -> None:
        """Wipe all stored observations."""
        if self.path.exists():
            self.path.unlink()
