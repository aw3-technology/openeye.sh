---
title: Agent API
---

The agent API provides REST endpoints for controlling the agentic perception loop and querying observation memory. All endpoints are prefixed with `/agent` and are served by `openeye serve`.

The server only tracks agent state: `/agent/start` records the goal and marks the agent running, but `openeye serve` doesn't run a perception loop itself, so `tick_count` stays 0 and memory stays empty unless something else feeds them. To run the loop, use `openeye agent run` locally.

### POST /agent/start

Mark the agent as running with a goal (resets tick count, plan, and events).

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

Mark the agent as stopped.

```json
{"status": "stopped", "ticks": 0}
```

### GET /agent/status

Get current agent status.

```json
{
  "running": true,
  "tick_count": 0,
  "current_plan": [],
  "goal": "monitor workspace safety"
}
```

### GET /agent/stream

Server-Sent Events (SSE) endpoint that streams any queued tick events while the agent is marked running, then sends `{"done": true}` once it stops.

### GET /agent/memory

Get recent observations from the agent's memory store.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | int | 20 | Number of recent observations to return |

### POST /agent/recall

Query the observation memory store with structured filters.

**Request body:** `RecallQuery` JSON:

```json
{"query": "person near the robot", "time_range": "last_1h", "significance_min": 0.0, "limit": 10}
```

All fields are optional (`time_range` takes values like `last_1h` or `last_24h`). The response is a `RecallResult` with an `observations` list.

### GET /agent/demo/stream

SSE stream of scripted demo data for frontend development without a running backend. Streams 10 pre-built ticks simulating a workspace safety monitoring scenario.
