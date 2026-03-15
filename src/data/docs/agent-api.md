---
title: Agent API
---

The agent API provides REST endpoints for controlling the agentic perception loop and querying observation memory. All endpoints are prefixed with `/agent`.

### POST /agent/start

Start the agentic loop as a background task.

**Request body:**
```json
{"goal": "monitor the scene"}
```

**Response:**
```json
{"status": "started", "goal": "monitor the scene"}
```

Returns 409 if an agent is already running.

### POST /agent/stop

Stop the running agentic loop.

```json
{"status": "stopped", "ticks": 42}
```

### GET /agent/status

Get current agent status.

```json
{
  "running": true,
  "tick_count": 42,
  "current_plan": ["Track person position", "Monitor hand proximity"],
  "goal": "monitor workspace safety"
}
```

### GET /agent/stream

Server-Sent Events (SSE) endpoint that streams `AgentTickEvent` objects in real time while the agent is running. Each event contains observation data, reasoning, and the action taken.

### GET /agent/memory

Get recent observations from the agent's memory store.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | int | 20 | Number of recent observations to return |

### POST /agent/recall

Query the observation memory store with structured filters.

**Request body:** `RecallQuery` JSON — supports filtering by tags, time range, and significance threshold.

### GET /agent/demo/stream

SSE stream of scripted demo data for frontend development without a running backend. Streams 10 pre-built ticks simulating a workspace safety monitoring scenario.
