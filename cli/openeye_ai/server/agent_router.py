"""FastAPI router for the agentic pipeline endpoints."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from openeye_ai.memory.store import ObservationMemoryStore
from openeye_ai.schema import (
    AgentReasoning,
    AgentTickEvent,
    Observation,
    RecallQuery,
    RecallResult,
)

router = APIRouter(prefix="/agent", tags=["agent"])

# Module-level state for the running agent loop
_agent_state: dict[str, Any] = {
    "running": False,
    "tick_count": 0,
    "current_plan": [],
    "goal": "",
    "events": [],  # recent events buffer
    "task": None,
}

_memory_store = ObservationMemoryStore()


@router.post("/start")
async def start_agent(request: Request) -> JSONResponse:
    """Start the agentic loop as a background task."""
    if _agent_state["running"]:
        return JSONResponse({"error": "Agent already running"}, status_code=409)

    body = await request.json()
    _agent_state["goal"] = body.get("goal", "monitor the scene")
    _agent_state["running"] = True
    _agent_state["tick_count"] = 0
    _agent_state["current_plan"] = []
    _agent_state["events"] = []

    return JSONResponse({"status": "started", "goal": _agent_state["goal"]})


@router.post("/stop")
async def stop_agent() -> JSONResponse:
    """Stop the agentic loop."""
    _agent_state["running"] = False
    return JSONResponse({"status": "stopped", "ticks": _agent_state["tick_count"]})


@router.get("/status")
async def agent_status() -> JSONResponse:
    """Get current agent status."""
    return JSONResponse({
        "running": _agent_state["running"],
        "tick_count": _agent_state["tick_count"],
        "current_plan": _agent_state["current_plan"],
        "goal": _agent_state["goal"],
    })


@router.get("/stream")
async def agent_stream() -> StreamingResponse:
    """SSE endpoint streaming AgentTickEvent."""

    async def event_generator():
        last_idx = 0
        while _agent_state["running"]:
            events = _agent_state["events"]
            if len(events) > last_idx:
                for evt in events[last_idx:]:
                    data = evt if isinstance(evt, str) else json.dumps(evt)
                    yield f"data: {data}\n\n"
                last_idx = len(events)
            await asyncio.sleep(0.5)
        yield "data: {\"done\": true}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/memory")
async def get_memory(limit: int = 20) -> JSONResponse:
    """Get recent observations from memory."""
    recent = _memory_store.recall_recent(limit)
    return JSONResponse([o.model_dump() for o in recent])


@router.post("/recall")
async def recall_memory(request: Request) -> JSONResponse:
    """Query observation memory."""
    body = await request.json()
    query = RecallQuery(**body)
    result = _memory_store.recall(query)
    return JSONResponse(result.model_dump())


@router.get("/demo/stream")
async def demo_stream() -> StreamingResponse:
    """SSE stream of scripted demo data for frontend without real backend."""
    from openeye_ai.schema import BBox, DetectedObject

    demo_ticks = _generate_demo_ticks()

    async def event_generator():
        for tick_event in demo_ticks:
            data = tick_event.model_dump_json()
            yield f"data: {data}\n\n"
            await asyncio.sleep(2.0)
        yield "data: {\"done\": true}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def _generate_demo_ticks() -> list[AgentTickEvent]:
    """Generate a scripted 10-tick demo scenario."""
    from openeye_ai.schema import BBox, DetectedObject

    ticks = []

    # Ticks 1-3: Empty desk
    for i in range(1, 4):
        ticks.append(AgentTickEvent(
            tick=i,
            phase="act",
            observation=Observation(
                tick=i,
                detections=[
                    DetectedObject(label="desk", confidence=0.95, bbox=BBox(x=0.1, y=0.3, w=0.8, h=0.6)),
                    DetectedObject(label="laptop", confidence=0.92, bbox=BBox(x=0.3, y=0.35, w=0.2, h=0.15)),
                    DetectedObject(label="cup", confidence=0.88, bbox=BBox(x=0.7, y=0.4, w=0.08, h=0.12)),
                ],
                scene_summary=f"3 objects — desk, laptop, cup",
                change_description="" if i > 1 else "",
                significance=0.1,
                tags=["desk", "laptop", "cup"],
            ),
            reasoning=AgentReasoning(
                observation_summary="Workspace with desk, laptop, and cup. No people.",
                memory_context="No prior observations." if i == 1 else f"Ticks 1-{i-1}: desk, laptop, cup. No changes.",
                chain_of_thought="Workspace is clear. Monitoring for human entry.",
                current_plan=["Monitor for human entry", "Track object positions"],
                decided_action="continue monitoring",
                plan_changed=i == 1,
            ),
            action_taken="continue monitoring",
            current_plan=["Monitor for human entry", "Track object positions"],
        ))

    # Tick 4: Person arrives
    ticks.append(AgentTickEvent(
        tick=4,
        phase="act",
        observation=Observation(
            tick=4,
            detections=[
                DetectedObject(label="desk", confidence=0.95, bbox=BBox(x=0.1, y=0.3, w=0.8, h=0.6)),
                DetectedObject(label="laptop", confidence=0.92, bbox=BBox(x=0.3, y=0.35, w=0.2, h=0.15)),
                DetectedObject(label="cup", confidence=0.88, bbox=BBox(x=0.7, y=0.4, w=0.08, h=0.12)),
                DetectedObject(label="person", confidence=0.97, bbox=BBox(x=0.15, y=0.1, w=0.3, h=0.8)),
            ],
            scene_summary="4 objects — person detected (97.2%)",
            change_description="appeared: person",
            significance=0.8,
            tags=["cup", "desk", "laptop", "person"],
        ),
        reasoning=AgentReasoning(
            observation_summary="Person entered the workspace. 4 objects now visible.",
            memory_context="Ticks 1-3: desk was empty with laptop and cup.",
            chain_of_thought="Person entered workspace. Adjusting plan for safety monitoring. Need to track hand positions and proximity to tools.",
            current_plan=["Track person position", "Monitor hand proximity to tools", "Alert if hands near hazards"],
            decided_action="update plan — person detected, switching to safety monitoring",
            plan_changed=True,
        ),
        action_taken="update plan — person detected, switching to safety monitoring",
        current_plan=["Track person position", "Monitor hand proximity to tools", "Alert if hands near hazards"],
    ))

    # Ticks 5-6: Person working
    for i in [5, 6]:
        ticks.append(AgentTickEvent(
            tick=i,
            phase="act",
            observation=Observation(
                tick=i,
                detections=[
                    DetectedObject(label="desk", confidence=0.95, bbox=BBox(x=0.1, y=0.3, w=0.8, h=0.6)),
                    DetectedObject(label="laptop", confidence=0.92, bbox=BBox(x=0.3, y=0.35, w=0.2, h=0.15)),
                    DetectedObject(label="person", confidence=0.96, bbox=BBox(x=0.2, y=0.1, w=0.3, h=0.8)),
                    DetectedObject(label="screwdriver", confidence=0.85, bbox=BBox(x=0.55, y=0.45, w=0.1, h=0.05)),
                ],
                scene_summary="4 objects — person working with screwdriver",
                change_description="appeared: screwdriver; disappeared: cup" if i == 5 else "",
                significance=0.6 if i == 5 else 0.2,
                tags=["desk", "laptop", "person", "screwdriver"],
            ),
            reasoning=AgentReasoning(
                observation_summary="Person is working with tools at the desk.",
                memory_context=f"Tick 4: person arrived. Now using screwdriver.",
                chain_of_thought="Person is handling tools safely. Screwdriver is within normal workspace zone. No hazards detected.",
                current_plan=["Track person position", "Monitor hand proximity to tools", "Alert if hands near hazards"],
                decided_action="continue monitoring — person working safely",
                plan_changed=False,
            ),
            action_taken="continue monitoring — person working safely",
            current_plan=["Track person position", "Monitor hand proximity to tools", "Alert if hands near hazards"],
        ))

    # Tick 7: Soldering iron appears — hazard
    ticks.append(AgentTickEvent(
        tick=7,
        phase="act",
        observation=Observation(
            tick=7,
            detections=[
                DetectedObject(label="desk", confidence=0.95, bbox=BBox(x=0.1, y=0.3, w=0.8, h=0.6)),
                DetectedObject(label="person", confidence=0.96, bbox=BBox(x=0.2, y=0.1, w=0.3, h=0.8)),
                DetectedObject(label="screwdriver", confidence=0.85, bbox=BBox(x=0.55, y=0.45, w=0.1, h=0.05)),
                DetectedObject(label="soldering_iron", confidence=0.91, bbox=BBox(x=0.6, y=0.42, w=0.12, h=0.06)),
            ],
            scene_summary="4 objects — soldering iron near screwdriver (hazard zone)",
            change_description="appeared: soldering_iron; disappeared: laptop",
            significance=0.9,
            tags=["desk", "person", "screwdriver", "soldering_iron"],
        ),
        reasoning=AgentReasoning(
            observation_summary="Soldering iron detected near other tools — potential hazard.",
            memory_context="Person has been working with screwdriver since tick 5. Now soldering iron appeared.",
            chain_of_thought="HAZARD: Soldering iron detected near screwdriver. Person's hands are close to both tools. Need to raise alert level and monitor closely.",
            current_plan=["ALERT: Monitor soldering iron proximity", "Track hand distance to hot tools", "Warn if person reaches toward soldering iron", "Log hazard event"],
            decided_action="alert — soldering iron detected near workspace, elevated monitoring",
            plan_changed=True,
        ),
        action_taken="alert — soldering iron detected near workspace, elevated monitoring",
        current_plan=["ALERT: Monitor soldering iron proximity", "Track hand distance to hot tools", "Warn if person reaches toward soldering iron", "Log hazard event"],
    ))

    # Tick 8: Person moves away
    ticks.append(AgentTickEvent(
        tick=8,
        phase="act",
        observation=Observation(
            tick=8,
            detections=[
                DetectedObject(label="desk", confidence=0.95, bbox=BBox(x=0.1, y=0.3, w=0.8, h=0.6)),
                DetectedObject(label="screwdriver", confidence=0.85, bbox=BBox(x=0.55, y=0.45, w=0.1, h=0.05)),
                DetectedObject(label="soldering_iron", confidence=0.91, bbox=BBox(x=0.6, y=0.42, w=0.12, h=0.06)),
            ],
            scene_summary="3 objects — person left workspace, tools remain",
            change_description="disappeared: person",
            significance=0.7,
            tags=["desk", "screwdriver", "soldering_iron"],
        ),
        reasoning=AgentReasoning(
            observation_summary="Person has left the workspace. Tools remain on desk including soldering iron.",
            memory_context="Person was working since tick 4. Soldering iron appeared at tick 7. Person now gone.",
            chain_of_thought="Person left workspace but soldering iron is still on desk. This could be a safety concern if the iron is still hot. Resetting to monitoring mode with note about unattended tools.",
            current_plan=["Monitor for person return", "Track unattended soldering iron", "Alert if soldering iron left unattended > 5 min"],
            decided_action="update plan — person left, monitoring unattended tools",
            plan_changed=True,
        ),
        action_taken="update plan — person left, monitoring unattended tools",
        current_plan=["Monitor for person return", "Track unattended soldering iron", "Alert if soldering iron left unattended > 5 min"],
    ))

    # Ticks 9-10: Scene clears
    for i in [9, 10]:
        ticks.append(AgentTickEvent(
            tick=i,
            phase="act",
            observation=Observation(
                tick=i,
                detections=[
                    DetectedObject(label="desk", confidence=0.95, bbox=BBox(x=0.1, y=0.3, w=0.8, h=0.6)),
                    DetectedObject(label="laptop", confidence=0.92, bbox=BBox(x=0.3, y=0.35, w=0.2, h=0.15)),
                ],
                scene_summary="2 objects — desk and laptop, workspace cleared",
                change_description="disappeared: screwdriver, soldering_iron; appeared: laptop" if i == 9 else "",
                significance=0.5 if i == 9 else 0.1,
                tags=["desk", "laptop"],
            ),
            reasoning=AgentReasoning(
                observation_summary="Workspace cleared. Only desk and laptop remain.",
                memory_context="Person worked ticks 4-7, left at tick 8. Tools now cleared.",
                chain_of_thought="Workspace is clean and safe. All hazardous tools removed. Returning to standard monitoring mode.",
                current_plan=["Monitor for human entry", "Track object positions"],
                decided_action="reset plan — workspace clear, resuming standard monitoring",
                plan_changed=i == 9,
            ),
            action_taken="reset plan — workspace clear, resuming standard monitoring" if i == 9 else "continue monitoring",
            current_plan=["Monitor for human entry", "Track object positions"],
        ))

    return ticks
