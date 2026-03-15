---
title: Multi-Mode Config
---

Multi-mode configs define multiple behavioral modes with transition rules:

```json5 {backend/config/multi_mode.json5}
{
  "version": "1.0.1",
  "name": "multi_mode_agent",
  "default_mode": "idle",
  "system_governance": "Be safe.",
  "modes": {
    "idle": {
      "display_name": "Idle",
      "description": "Waiting for input",
      "system_prompt_base": "You are idle.",
      "hertz": 0.5,
      "agent_inputs": [],
      "cortex_llm": {"type": "openai", "config": {}}
    },
    "active": {
      "display_name": "Active",
      "description": "Processing input",
      "system_prompt_base": "You are active.",
      "hertz": 2.0,
      "agent_inputs": [],
      "cortex_llm": {"type": "openai", "config": {}}
    }
  },
  "transition_rules": [
    {
      "from_mode": "idle",
      "to_mode": "active",
      "transition_type": "input_triggered",
      "trigger_keywords": ["hello", "start"]
    }
  ]
}
```
