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

- **Object detection** with tracking
- **3D position estimation**
- **Scene graph generation** with spatial relationships
- **Safety Guardian** — zone-based awareness with halt protocol
- **Change detection** — alerts on scene changes
- **Natural language queries** — ask questions about the scene

## Data Flow

1. Input sensors produce observations at configurable Hz
2. IOProvider buffers inputs with timestamps and tick counters
3. Fuser combines inputs into a prompt
4. LLM generates reasoning and action decisions
5. Actions execute (robot commands, logging, etc.)
6. Background tasks run continuously (monitoring, etc.)
