---
title: Single-Mode Config
---

A single-mode config defines one behavior set for the agent. Input and LLM types are plugin class names (for example VLMOpenAI, VLMNebius, OpenAILLM, AnthropicLLM); ${VAR} values are read from the environment:

```json5
{
  "version": "v1.0.3",
  "name": "my_agent",
  "api_key": "${OPENAI_API_KEY}",
  "system_prompt_base": "You are a helpful robot assistant.",
  "system_governance": "Be safe and helpful.",
  "system_prompt_examples": "",
  "hertz": 1.0,
  "agent_inputs": [
    {"type": "VLMOpenAI", "config": {"base_url": "https://api.openai.com/v1", "camera_index": 0}}
  ],
  "cortex_llm": {
    "type": "OpenAILLM", "config": {"agent_name": "OpenEye", "model": "gpt-4o-mini"}
  },
  "agent_actions": [
    {"name": "log_action", "llm_label": "log", "connector": "log"}
  ]
}
```
