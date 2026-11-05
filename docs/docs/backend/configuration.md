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

## Fleet Control Plane

The fleet control plane (`backend/src/fleet/`) is a separate FastAPI app that you host yourself. It stores everything in Postgres; Neon works, as does any other Postgres database. OpenEye does not run a public instance for you.

### Environment

Set these in the environment of the control plane process (see `backend/.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Postgres connection string. For Neon, prefer the pooled endpoint, with `?sslmode=require`. |
| `DATABASE_POOL_MAX` | No | `10` | Max connections in the pool |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | Comma-separated browser origins allowed to call the API |
| `CRED_API_KEY` | No | — | Cred credits API key for the control plane's `/v1` routes. Unset means credits are **disabled**: every call is allowed and nothing is charged. |
| `CRED_API_BASE` | No | Cred's API | Cred API base URL |
| `CRED_CREDIT_TYPE_ID` | No | — | Cred credit type to charge |
| `CRED_APP_ORIGIN` | No | `https://openeye.sh` | Origin sent to Cred |

### Apply the schema

The control plane uses the same schema as the website, in `db/schema.sql` (users and sessions, API keys, devices, deployments, groups, maintenance windows, alerts, heartbeats, device commands). Apply it once, and again after pulling schema changes (the statements are `create ... if not exists`):

```bash
# From the repo root. Reads DATABASE_URL_UNPOOLED, else DATABASE_URL, from .env.local
npm run db:migrate

# Or with psql
psql "$DATABASE_URL" -f db/schema.sql
```

### Run it

```bash
make install-backend          # pip install -e backend/ --group dev
export DATABASE_URL="postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
cd backend/src
uvicorn fleet.app:create_fleet_app --factory --host 0.0.0.0 --port 8001
```

`GET /health` returns `{"status": "ok", "service": "fleet-control-plane"}`. Routers are mounted at `/devices`, `/heartbeats`, `/deployments`, `/groups`, `/maintenance`, `/alerts`, `/ota`, `/commands`, and `/v1`.

### Authentication

| Caller | Credential | Header |
|--------|------------|--------|
| People (CLI, scripts) | Better Auth session token from the same database | `Authorization: Bearer <session-token>` |
| Edge devices | Device key (`oek_...`) returned once at registration | `X-Device-API-Key: oek_...` |
| `/v1` inference routes | User API key (`oe_...`) | `Authorization: Bearer oe_...` or `X-API-Key: oe_...` |

Sessions and API keys are looked up in the control plane's own database, so users must exist there. The simplest way is to run the website against the same `DATABASE_URL` (`vercel dev` locally, or your own deployment) and sign up there. A session token is the value of the Better Auth session cookie; both the raw token and the signed cookie value are accepted. Keys are stored as SHA-256 hashes.

Fleet endpoints are rate limited in memory per client IP (configured for 120 requests per minute); `/health` and `/v1` are exempt.

## Environment Variables

Use `${ENV_VAR}` syntax in config values — they are resolved at load time via `runtime.env.load_env_vars()`.
