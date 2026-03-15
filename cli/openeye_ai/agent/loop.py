"""Core agentic loop: perceive → observe → recall → reason → act."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, Optional

from openeye_ai.memory.store import ObservationMemoryStore
from openeye_ai.schema import (
    AgentReasoning,
    AgentTickEvent,
    DetectedObject,
    Observation,
)

logger = logging.getLogger(__name__)


def _diff_detections(
    prev: list[DetectedObject], curr: list[DetectedObject]
) -> tuple[str, float]:
    """Compare detection label sets, return (change_description, significance)."""
    prev_labels = {d.label for d in prev}
    curr_labels = {d.label for d in curr}

    appeared = curr_labels - prev_labels
    disappeared = prev_labels - curr_labels

    parts: list[str] = []
    if appeared:
        parts.append(f"appeared: {', '.join(sorted(appeared))}")
    if disappeared:
        parts.append(f"disappeared: {', '.join(sorted(disappeared))}")

    if not parts:
        return "", 0.0

    desc = "; ".join(parts)
    # Significance: more changes = higher significance
    sig = min(1.0, (len(appeared) + len(disappeared)) * 0.25)
    return desc, sig


def _build_scene_summary(detections: list[DetectedObject]) -> str:
    """Build a simple scene summary from detections."""
    if not detections:
        return "Empty scene — no objects detected."
    labels = [f"{d.label}({d.confidence:.0%})" for d in detections]
    return f"{len(detections)} objects — {', '.join(labels)}"


def _build_llm_prompt(
    goal: str,
    scene_summary: str,
    memory_context: str,
    current_plan: list[str],
    change_description: str,
) -> str:
    """Construct the LLM prompt following fuser pattern."""
    plan_str = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(current_plan)) if current_plan else "  No plan yet."
    return f"""You are an autonomous vision agent monitoring a scene.

GOAL: {goal}

CURRENT SCENE:
{scene_summary}

{f"CHANGE DETECTED: {change_description}" if change_description else "No changes detected since last tick."}

MEMORY (recent observations):
{memory_context}

CURRENT PLAN:
{plan_str}

Based on the current scene and your memory, respond in this exact format:
THOUGHT: <your reasoning about what's happening and what to do>
ACTION: <the action to take, e.g. "continue monitoring", "alert: person near hazard", "update plan">
PLAN:
1. <step 1>
2. <step 2>
3. <step 3>
PLAN_CHANGED: <yes or no>"""


def _parse_llm_response(response: str) -> AgentReasoning:
    """Parse structured LLM response into AgentReasoning."""
    thought = ""
    action = ""
    plan: list[str] = []
    plan_changed = False

    for line in response.strip().splitlines():
        line = line.strip()
        if line.upper().startswith("THOUGHT:"):
            thought = line[len("THOUGHT:"):].strip()
        elif line.upper().startswith("ACTION:"):
            action = line[len("ACTION:"):].strip()
        elif line.upper().startswith("PLAN_CHANGED:"):
            plan_changed = line[len("PLAN_CHANGED:"):].strip().lower() in ("yes", "true")
        elif line and line[0].isdigit() and "." in line[:3]:
            plan.append(line.split(".", 1)[1].strip())

    return AgentReasoning(
        observation_summary="",
        memory_context="",
        chain_of_thought=thought,
        current_plan=plan,
        decided_action=action,
        plan_changed=plan_changed,
    )


class AgentLoop:
    """Continuous perception → reasoning → action loop."""

    def __init__(
        self,
        adapters: dict[str, Any],
        camera: Any,
        *,
        hz: float = 1.0,
        goal: str = "monitor the scene",
        memory_store: Optional[ObservationMemoryStore] = None,
        llm_call: Optional[Callable[[str], str]] = None,
        memory_recall_count: int = 5,
    ) -> None:
        self.adapters = adapters
        self.camera = camera
        self.hz = hz
        self.goal = goal
        self.memory = memory_store or ObservationMemoryStore()
        self.llm_call = llm_call
        self.memory_recall_count = memory_recall_count

        self.running = False
        self.tick = 0
        self.current_plan: list[str] = []
        self.prev_detections: list[DetectedObject] = []
        self._callbacks: list[Callable[[AgentTickEvent], None]] = []

    def on_tick(self, callback: Callable[[AgentTickEvent], None]) -> None:
        """Register a callback invoked on each tick event."""
        self._callbacks.append(callback)

    def _emit(self, event: AgentTickEvent) -> None:
        for cb in self._callbacks:
            try:
                cb(event)
            except Exception:
                logger.exception("Tick callback error")

    def stop(self) -> None:
        self.running = False

    def run(self) -> None:
        """Run the agentic loop until stopped."""
        self.running = True
        interval = 1.0 / self.hz

        while self.running:
            loop_start = time.perf_counter()
            self.tick += 1

            # 1. PERCEIVE
            frame = self.camera.read_pil()
            if frame is None:
                time.sleep(0.1)
                continue

            all_detections: list[DetectedObject] = []
            prediction = None
            for _name, adapter in self.adapters.items():
                result = adapter.predict(frame)
                for obj_data in result.get("objects", []):
                    all_detections.append(DetectedObject(**obj_data))
                if prediction is None:
                    from openeye_ai.schema import ImageInfo, PredictionResult
                    w, h = frame.size
                    prediction = PredictionResult(
                        model=_name,
                        task="detection",
                        image=ImageInfo(width=w, height=h, source="camera"),
                        objects=[DetectedObject(**o) for o in result.get("objects", [])],
                        inference_ms=result.get("inference_ms", 0.0),
                    )

            self._emit(AgentTickEvent(tick=self.tick, phase="perceive", prediction=prediction, current_plan=self.current_plan))

            # 2. OBSERVE — diff with previous
            scene_summary = _build_scene_summary(all_detections)
            change_desc, significance = _diff_detections(self.prev_detections, all_detections)

            # Tag based on detected labels
            tags = sorted({d.label for d in all_detections})
            if "person" in tags:
                significance = max(significance, 0.5)

            observation = Observation(
                tick=self.tick,
                detections=all_detections,
                scene_summary=scene_summary,
                change_description=change_desc,
                significance=significance,
                tags=tags,
            )

            # Only store significant observations
            if significance > 0.1 or self.tick == 1:
                self.memory.store(observation)

            self.prev_detections = all_detections

            # 3. RECALL
            recalled = self.memory.recall_recent(self.memory_recall_count)
            memory_context = self.memory.summarize(recalled)

            self._emit(AgentTickEvent(
                tick=self.tick, phase="recall",
                observation=observation,
                memory_recalled=recalled,
                current_plan=self.current_plan,
            ))

            # 4. REASON
            reasoning = AgentReasoning(
                observation_summary=scene_summary,
                memory_context=memory_context,
                chain_of_thought=f"Scene has {len(all_detections)} objects. {'Changes detected.' if change_desc else 'No changes.'}",
                current_plan=self.current_plan,
                decided_action="continue monitoring",
                plan_changed=False,
            )

            if self.llm_call:
                prompt = _build_llm_prompt(
                    self.goal, scene_summary, memory_context, self.current_plan, change_desc
                )
                try:
                    llm_response = self.llm_call(prompt)
                    reasoning = _parse_llm_response(llm_response)
                    reasoning.observation_summary = scene_summary
                    reasoning.memory_context = memory_context
                except Exception:
                    logger.exception("LLM call failed, using fallback reasoning")

            if reasoning.plan_changed and reasoning.current_plan:
                self.current_plan = reasoning.current_plan

            self._emit(AgentTickEvent(
                tick=self.tick, phase="reason",
                observation=observation,
                reasoning=reasoning,
                current_plan=self.current_plan,
            ))

            # 5. ACT
            action = reasoning.decided_action or "continue monitoring"
            self._emit(AgentTickEvent(
                tick=self.tick, phase="act",
                observation=observation,
                reasoning=reasoning,
                action_taken=action,
                memory_recalled=recalled,
                current_plan=self.current_plan,
            ))

            # Pace the loop
            elapsed = time.perf_counter() - loop_start
            sleep_time = max(0, interval - elapsed)
            if sleep_time > 0 and self.running:
                time.sleep(sleep_time)
