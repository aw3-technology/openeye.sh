---
title: Multi-Mode Config
---

Multi-mode configs define multiple behavioral modes with transition rules. The top-level cortex_llm is used by every mode unless a mode sets its own; backend/config/openeye_vlm.json5 is a working example:

```json5
{
  "version": "v1.0.3",
  "default_mode": "idle",
  "api_key": "${OPENAI_API_KEY}",
  "system_governance": "Be safe.",
  "cortex_llm": {"type": "OpenAILLM", "config": {"model": "gpt-4o-mini"}},
  "modes": {
    "idle": {
      "display_name": "Idle",
      "description": "Waiting for input",
      "system_prompt_base": "You are idle.",
      "hertz": 0.5,
      "agent_inputs": [],
      "agent_actions": []
    },
    "active": {
      "display_name": "Active",
      "description": "Processing input",
      "system_prompt_base": "You are active.",
      "hertz": 2.0,
      "agent_inputs": [{"type": "VLMOpenAI", "config": {"camera_index": 0}}],
      "agent_actions": [{"name": "log_action", "llm_label": "log", "connector": "log"}]
    }
  },
  "transition_rules": [
    {
      "from_mode": "idle",
      "to_mode": "active",
      "transition_type": "input_triggered",
      "trigger_keywords": ["hello", "start"],
      "priority": 1
    }
  ]
}
```
