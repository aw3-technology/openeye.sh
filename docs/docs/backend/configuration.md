# Configuration

The backend uses JSON5 configuration files with schema validation.

## Config Location

Configuration files live in `backend/config/` and are JSON5 format (supports comments and trailing commas).

## Structure

### Single-Mode Config

```json5
{
  "version": "1.0.1",
  "name": "my_agent",
  "system_prompt_base": "You are a helpful robot assistant.",
  "system_governance": "Be safe and helpful.",
  "system_prompt_examples": "",
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

### Multi-Mode Config

```json5
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

## Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Config schema version |
| `name` | string | Agent name |
| `hertz` | float | Processing frequency |
| `system_prompt_base` | string | Base system prompt |
| `agent_inputs` | array | Input sensor configs |
| `cortex_llm` | object | LLM provider config |
| `agent_actions` | array | Action plugin configs |

## Schema Validation

Configs are validated against JSON schemas in `backend/config/schema/`:

- `single_mode_schema.json` — Single-mode configs
- `multi_mode_schema.json` — Multi-mode configs

## Environment Variables

Use `${ENV_VAR}` syntax in config values — they are resolved at load time via `runtime.env.load_env_vars()`.
