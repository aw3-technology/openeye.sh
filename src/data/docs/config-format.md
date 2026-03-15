---
title: Config Format
---

The backend uses JSON5 configuration files with schema validation. Configuration files live in backend/config/ and support comments and trailing commas.

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| version | string | Config schema version |
| name | string | Agent name |
| hertz | float | Processing frequency |
| system_prompt_base | string | Base system prompt |
| agent_inputs | array | Input sensor configs |
| cortex_llm | object | LLM provider config |
| agent_actions | array | Action plugin configs |
