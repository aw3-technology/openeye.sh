"""Scripted demo tick data for the agentic pipeline frontend.

Extracted from agent_router.py — provides a 10-tick scenario that exercises
the full agent loop (observe → reason → act) without requiring a running
camera or model backend.
"""

from __future__ import annotations

from openeye_ai.schema import (
    AgentReasoning,
    AgentTickEvent,
    BBox,
    DetectedObject,
    Observation,
)

# ── Reusable detection sets ─────────────────────────────────────────

_DESK = DetectedObject(label="desk", confidence=0.95, bbox=BBox(x=0.1, y=0.3, w=0.8, h=0.6))
_LAPTOP = DetectedObject(label="laptop", confidence=0.92, bbox=BBox(x=0.3, y=0.35, w=0.2, h=0.15))
_CUP = DetectedObject(label="cup", confidence=0.88, bbox=BBox(x=0.7, y=0.4, w=0.08, h=0.12))
_PERSON = DetectedObject(label="person", confidence=0.97, bbox=BBox(x=0.15, y=0.1, w=0.3, h=0.8))
_PERSON_MOVED = DetectedObject(label="person", confidence=0.96, bbox=BBox(x=0.2, y=0.1, w=0.3, h=0.8))
_SCREWDRIVER = DetectedObject(label="screwdriver", confidence=0.85, bbox=BBox(x=0.55, y=0.45, w=0.1, h=0.05))
_SOLDER = DetectedObject(label="soldering_iron", confidence=0.91, bbox=BBox(x=0.6, y=0.42, w=0.12, h=0.06))

_PLAN_MONITOR = ["Monitor for human entry", "Track object positions"]
_PLAN_SAFETY = ["Track person position", "Monitor hand proximity to tools", "Alert if hands near hazards"]
_PLAN_ALERT = [
    "ALERT: Monitor soldering iron proximity",
    "Track hand distance to hot tools",
    "Warn if person reaches toward soldering iron",
    "Log hazard event",
]
_PLAN_UNATTENDED = [
    "Monitor for person return",
    "Track unattended soldering iron",
    "Alert if soldering iron left unattended > 5 min",
]


# ── Tick builders ───────────────────────────────────────────────────


def _tick(
    tick: int,
    detections: list[DetectedObject],
    scene: str,
    change: str,
    significance: float,
    tags: list[str],
    obs_summary: str,
    memory: str,
    thought: str,
    plan: list[str],
    action: str,
    plan_changed: bool,
) -> AgentTickEvent:
    return AgentTickEvent(
        tick=tick,
        phase="act",
        observation=Observation(
            tick=tick,
            detections=detections,
            scene_summary=scene,
            change_description=change,
            significance=significance,
            tags=tags,
        ),
        reasoning=AgentReasoning(
            observation_summary=obs_summary,
            memory_context=memory,
            chain_of_thought=thought,
            current_plan=plan,
            decided_action=action,
            plan_changed=plan_changed,
        ),
        action_taken=action,
        current_plan=plan,
    )


def generate_demo_ticks() -> list[AgentTickEvent]:
    """Generate a scripted 10-tick demo scenario."""
    ticks: list[AgentTickEvent] = []

    # Ticks 1-3: Empty desk
    for i in range(1, 4):
        ticks.append(_tick(
            tick=i,
            detections=[_DESK, _LAPTOP, _CUP],
            scene="3 objects — desk, laptop, cup",
            change="",
            significance=0.1,
            tags=["desk", "laptop", "cup"],
            obs_summary="Workspace with desk, laptop, and cup. No people.",
            memory="No prior observations." if i == 1 else f"Ticks 1-{i-1}: desk, laptop, cup. No changes.",
            thought="Workspace is clear. Monitoring for human entry.",
            plan=_PLAN_MONITOR,
            action="continue monitoring",
            plan_changed=(i == 1),
        ))

    # Tick 4: Person arrives
    ticks.append(_tick(
        tick=4,
        detections=[_DESK, _LAPTOP, _CUP, _PERSON],
        scene="4 objects — person detected (97.2%)",
        change="appeared: person",
        significance=0.8,
        tags=["cup", "desk", "laptop", "person"],
        obs_summary="Person entered the workspace. 4 objects now visible.",
        memory="Ticks 1-3: desk was empty with laptop and cup.",
        thought="Person entered workspace. Adjusting plan for safety monitoring. Need to track hand positions and proximity to tools.",
        plan=_PLAN_SAFETY,
        action="update plan — person detected, switching to safety monitoring",
        plan_changed=True,
    ))

    # Ticks 5-6: Person working
    for i in [5, 6]:
        ticks.append(_tick(
            tick=i,
            detections=[_DESK, _LAPTOP, _PERSON_MOVED, _SCREWDRIVER],
            scene="4 objects — person working with screwdriver",
            change="appeared: screwdriver; disappeared: cup" if i == 5 else "",
            significance=0.6 if i == 5 else 0.2,
            tags=["desk", "laptop", "person", "screwdriver"],
            obs_summary="Person is working with tools at the desk.",
            memory="Tick 4: person arrived. Now using screwdriver.",
            thought="Person is handling tools safely. Screwdriver is within normal workspace zone. No hazards detected.",
            plan=_PLAN_SAFETY,
            action="continue monitoring — person working safely",
            plan_changed=False,
        ))

    # Tick 7: Soldering iron appears — hazard
    ticks.append(_tick(
        tick=7,
        detections=[_DESK, _PERSON_MOVED, _SCREWDRIVER, _SOLDER],
        scene="4 objects — soldering iron near screwdriver (hazard zone)",
        change="appeared: soldering_iron; disappeared: laptop",
        significance=0.9,
        tags=["desk", "person", "screwdriver", "soldering_iron"],
        obs_summary="Soldering iron detected near other tools — potential hazard.",
        memory="Person has been working with screwdriver since tick 5. Now soldering iron appeared.",
        thought="HAZARD: Soldering iron detected near screwdriver. Person's hands are close to both tools. Need to raise alert level and monitor closely.",
        plan=_PLAN_ALERT,
        action="alert — soldering iron detected near workspace, elevated monitoring",
        plan_changed=True,
    ))

    # Tick 8: Person moves away
    ticks.append(_tick(
        tick=8,
        detections=[_DESK, _SCREWDRIVER, _SOLDER],
        scene="3 objects — person left workspace, tools remain",
        change="disappeared: person",
        significance=0.7,
        tags=["desk", "screwdriver", "soldering_iron"],
        obs_summary="Person has left the workspace. Tools remain on desk including soldering iron.",
        memory="Person was working since tick 4. Soldering iron appeared at tick 7. Person now gone.",
        thought="Person left workspace but soldering iron is still on desk. This could be a safety concern if the iron is still hot. Resetting to monitoring mode with note about unattended tools.",
        plan=_PLAN_UNATTENDED,
        action="update plan — person left, monitoring unattended tools",
        plan_changed=True,
    ))

    # Ticks 9-10: Scene clears
    for i in [9, 10]:
        ticks.append(_tick(
            tick=i,
            detections=[_DESK, _LAPTOP],
            scene="2 objects — desk and laptop, workspace cleared",
            change="disappeared: screwdriver, soldering_iron; appeared: laptop" if i == 9 else "",
            significance=0.5 if i == 9 else 0.1,
            tags=["desk", "laptop"],
            obs_summary="Workspace cleared. Only desk and laptop remain.",
            memory="Person worked ticks 4-7, left at tick 8. Tools now cleared.",
            thought="Workspace is clean and safe. All hazardous tools removed. Returning to standard monitoring mode.",
            plan=_PLAN_MONITOR,
            action="reset plan — workspace clear, resuming standard monitoring" if i == 9 else "continue monitoring",
            plan_changed=(i == 9),
        ))

    return ticks
