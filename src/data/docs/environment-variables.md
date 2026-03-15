---
title: Environment Variables
---

Use ${ENV_VAR} syntax in config values — they are resolved at load time via runtime.env.load_env_vars().

### Schema Validation

Configs are validated against JSON schemas in backend/config/schema/:

- single_mode_schema.json — Single-mode configs
- multi_mode_schema.json — Multi-mode configs
