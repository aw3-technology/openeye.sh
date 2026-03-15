# Backend Architecture

The OpenEye backend is a mode-based cortex runtime for autonomous perception and reasoning.

## Overview

The backend processes sensor inputs through a configurable pipeline:

```
Inputs → Fuser → LLM Cortex → Actions → Outputs
```

## Core Concepts

### Modes

The runtime operates in **modes** — distinct behavioral configurations. Each mode defines its own:

- Input sensors
- LLM provider
- Actions
- Background tasks
- System prompt

Modes can transition based on input triggers, time, or context.

### Providers (Singletons)

Thread-safe singleton providers manage shared state:

- **IOProvider** — Input/output buffer with thread-safe access, tick counter, fuser/LLM state
- **SleepTickerProvider** — Async sleep with cancellation support
- **ConfigProvider** — Runtime configuration
- **TelemetryProvider** — Metrics collection and reporting
- **AvatarProvider** — Robot/avatar state management
- **EventBus** — Pub/sub event system

### Plugin System

All components are loaded dynamically via plugin loaders:

- `load_input()` — Load sensor plugins (VLM, camera, video)
- `load_llm()` — Load LLM providers (OpenAI, Gemini)
- `load_action()` — Load action plugins
- `load_simulator()` — Load simulators
- `load_background()` — Load background tasks

### Configuration

Configurations are JSON5 files with schema validation. See [Configuration](configuration.md).

## Perception Pipeline

The perception subsystem (under `perception/`) provides:

- **Object detection** with multi-object tracking across frames
- **3D position estimation** from 2D detections
- **Scene graph generation** with spatial relationships
- **Safety Guardian** — zone-based awareness with halt protocol (configurable danger/caution thresholds)
- **Change detection** — alerts on scene changes and anomalies
- **Scene description** — generate text descriptions of scenes
- **Natural language queries** — ask questions about the scene graph

## Governance Engine

The governance subsystem (under `governance/`) enforces safety policies:

- **Zone policies** — restrict actions based on spatial zones
- **PII filters** — detect and filter personally identifiable information
- **Rate limiters** — enforce rate limits on actions
- **Action filters** — allow/block specific action types
- **Object restrictions** — restrict operations on certain object types
- **Audit logging** — comprehensive audit trail for compliance

Policies are loaded from YAML/JSON files and enforced at the perception pipeline level.

## Fleet Management

The fleet subsystem (under `fleet/`) provides a control plane for edge devices:

- **Device registry** — register, enumerate, and manage devices (cameras, robots, edge nodes, gateways, drones)
- **Model deployment** — deploy and rollback model versions to devices
- **OTA updates** — over-the-air firmware and software updates
- **Device agent** — runs on each device with heartbeat, model caching, and resource monitoring
- **Alerts** — fleet-wide alert management

The fleet control plane runs as a separate FastAPI server on port 8001.

## Actions

Action plugins (under `actions/`) execute decisions:

- **Log action** — log observations and decisions
- **Robot control** — send commands to robot platforms (e.g., Unitree G1)
- **Safety search** — web search (via Tavily) for safety context
- **Orchestrator** — execute multi-step action plans

## Knowledge Base

The fuser subsystem (under `fuser/`) provides:

- **FAISS embedding-based retrieval** for agentic memory
- **Nebius embedding client** for generating embeddings
- **Knowledge base** for persistent context across reasoning cycles

## Data Flow

1. Input sensors produce observations at configurable Hz
2. IOProvider buffers inputs with timestamps and tick counters
3. Fuser combines inputs into a prompt
4. LLM generates reasoning and action decisions
5. Actions execute (robot commands, logging, etc.)
6. Background tasks run continuously (monitoring, etc.)
