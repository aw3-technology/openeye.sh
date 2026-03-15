---
title: Single-Mode Config
---

A single-mode config defines one behavior set for the agent:

```json5 {backend/config/example.json5}
{
  "version": "1.0.1",
  "name": "my_agent",
  "system_prompt_base": "You are a helpful robot assistant.",
  "system_governance": "Be safe and helpful.",
  "hertz": 1.0,
  "agent_inputs": [
    {"type": "vlm_openai", "config": {"model": "gpt-4o"}}
  ],
  "cortex_llm": {
    "type": "openai", "config": {"model": "gpt-4o"}
  },
  "agent_actions": [],
  "simulators": [],
  "backgrounds": []
}
```
