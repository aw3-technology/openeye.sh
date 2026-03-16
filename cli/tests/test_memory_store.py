"""Tests for ObservationMemoryStore (User Story 88)."""

from __future__ import annotations

import time

from openeye_ai.memory.store import ObservationMemoryStore
from openeye_ai.schema import BBox, DetectedObject, Observation, RecallQuery


def _make_obs(tick: int, *, significance: float = 0.5, tags: list[str] | None = None, summary: str = "") -> Observation:
    """Helper to create a test Observation."""
    return Observation(
        tick=tick,
        detections=[
            DetectedObject(label="person", confidence=0.9, bbox=BBox(x=0.1, y=0.2, w=0.3, h=0.4)),
        ],
        scene_summary=summary or f"tick {tick} scene",
        change_description="",
        significance=significance,
        tags=tags or ["person"],
    )


# ── store + recall_recent ─────────────────────────────────────────────


def test_store_and_recall_recent(memory_store: ObservationMemoryStore):
    obs1 = _make_obs(1)
    obs2 = _make_obs(2)
    memory_store.store(obs1)
    memory_store.store(obs2)

    recent = memory_store.recall_recent(5)
    assert len(recent) == 2
    assert recent[0].tick == 1
    assert recent[1].tick == 2


def test_recall_recent_respects_limit(memory_store: ObservationMemoryStore):
    for i in range(1, 6):
        memory_store.store(_make_obs(i))

    recent = memory_store.recall_recent(2)
    assert len(recent) == 2
    assert recent[0].tick == 4
    assert recent[1].tick == 5


# ── JSONL persistence ─────────────────────────────────────────────────


def test_persistence_across_instances(tmp_path):
    path = tmp_path / "obs.jsonl"
    store1 = ObservationMemoryStore(path=path)
    store1.store(_make_obs(1))
    store1.store(_make_obs(2))

    store2 = ObservationMemoryStore(path=path)
    recent = store2.recall_recent(5)
    assert len(recent) == 2
    assert recent[0].tick == 1


# ── recall with filters ──────────────────────────────────────────────


def test_recall_keyword_filter(memory_store: ObservationMemoryStore):
    memory_store.store(_make_obs(1, summary="person near desk"))
    memory_store.store(_make_obs(2, tags=["desk"], summary="empty room"))
    memory_store.store(_make_obs(3, summary="person holding tool"))

    result = memory_store.recall(RecallQuery(query="person", limit=10))
    assert result.total_matches == 2
    assert all("person" in o.scene_summary for o in result.observations)


def test_recall_significance_filter(memory_store: ObservationMemoryStore):
    memory_store.store(_make_obs(1, significance=0.1))
    memory_store.store(_make_obs(2, significance=0.5))
    memory_store.store(_make_obs(3, significance=0.9))

    result = memory_store.recall(RecallQuery(significance_min=0.5, limit=10))
    assert result.total_matches == 2
    assert all(o.significance >= 0.5 for o in result.observations)


def test_recall_limit(memory_store: ObservationMemoryStore):
    for i in range(1, 11):
        memory_store.store(_make_obs(i))

    result = memory_store.recall(RecallQuery(limit=3))
    assert len(result.observations) == 3
    assert result.total_matches == 10


def test_recall_time_range(memory_store: ObservationMemoryStore):
    """All observations are created 'now', so last_5m should include them."""
    memory_store.store(_make_obs(1))
    memory_store.store(_make_obs(2))

    result = memory_store.recall(RecallQuery(time_range="last_5m", limit=10))
    assert result.total_matches == 2


# ── summarize ─────────────────────────────────────────────────────────


def test_summarize_with_observations(memory_store: ObservationMemoryStore):
    obs = [_make_obs(1, summary="person at desk"), _make_obs(2, summary="empty room")]
    summary = memory_store.summarize(obs)
    assert "tick 1" in summary
    assert "tick 2" in summary
    assert "person at desk" in summary


def test_summarize_empty(memory_store: ObservationMemoryStore):
    assert memory_store.summarize([]) == "No prior observations."


# ── clear ─────────────────────────────────────────────────────────────


def test_clear(memory_store: ObservationMemoryStore):
    memory_store.store(_make_obs(1))
    memory_store.store(_make_obs(2))
    memory_store.clear()

    assert memory_store.recall_recent(10) == []


# ── empty store edge case ─────────────────────────────────────────────


def test_empty_store_recall(memory_store: ObservationMemoryStore):
    assert memory_store.recall_recent(5) == []
    result = memory_store.recall(RecallQuery(query="anything", limit=5))
    assert result.total_matches == 0
    assert result.observations == []
