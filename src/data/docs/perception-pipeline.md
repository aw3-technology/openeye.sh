---
title: Perception Pipeline
---

The perception subsystem provides:

- Object detection with tracking
- 3D position estimation
- Scene graph generation with spatial relationships
- Safety Guardian — zone-based awareness with halt protocol
- Change detection — alerts on scene changes
- Natural language queries — ask questions about the scene

### Data Flow

- Input sensors produce observations at configurable Hz
- IOProvider buffers inputs with timestamps and tick counters
- Fuser combines inputs into a prompt
- LLM generates reasoning and action decisions
- Actions execute (robot commands, logging, etc.)
- Background tasks run continuously (monitoring, etc.)
