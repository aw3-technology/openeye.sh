---
title: Overview
---

The OpenEye backend is a mode-based cortex runtime for autonomous perception and reasoning. It processes sensor inputs through a configurable pipeline.

```text
Inputs → Fuser → LLM Cortex → Actions → Outputs
```

### Core Concepts

The runtime operates in modes — distinct behavioral configurations. Each mode defines its own input sensors, LLM provider, actions, background tasks, and system prompt. Modes can transition based on input triggers, time, or context.
