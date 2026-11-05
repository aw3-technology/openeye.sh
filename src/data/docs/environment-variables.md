---
title: Environment Variables
---

### CLI

Read by the openeye command. URLs have no trailing /v1; the CLI appends paths itself.

| Variable | Default | Used by |
|----------|---------|---------|
| OPENEYE_API_URL | https://openeye.sh | openeye api ... (hosted API base URL) |
| OPENEYE_API_KEY | — | openeye api ... — your oe_ key, sent as Authorization: Bearer |
| OPENEYE_SERVER_URL | http://localhost:8000 | health, nebius-stats, server-config-get/set, agent start/stop/status/memory/recall |
| OPENEYE_FLEET_URL | http://localhost:8001 | openeye fleet ... and the fleet agent --server default |
| OPENEYE_TOKEN | — | openeye fleet ... — Better Auth session token for the control plane |
| OPENEYE_DEVICE_API_KEY | — | openeye fleet agent — the device's oek_ key |

Every --server option overrides the matching URL for one command. The govern commands work on the local engine unless you pass --server.

### openeye serve

| Variable | Default | Purpose |
|----------|---------|---------|
| CORS_ORIGINS | https://openeye.sh, https://www.openeye.sh, http://localhost:5173, http://localhost:3000, http://localhost:8080 | Comma-separated browser origins allowed to call the server; replaces the default list |
| OPENEYE_SERVER_API_KEY | — | If set, the /v1 routes accept only this exact Bearer key instead of any oe_ key |
| OPENROUTER_API_KEY | — | VLM calls through OpenRouter (/ws/vlm, /vlm/analyze, agent loop, vlm-demo) |
| NEBIUS_API_KEY | — | VLM calls through Nebius Token Factory |
| NEBIUS_MODEL | Qwen/Qwen2.5-VL-72B-Instruct | Default VLM model ID when --vlm-model or runtime config doesn't set one |
| NEBIUS_BASE_URL | https://api.studio.nebius.com/v1 | Nebius-compatible endpoint |

The provider is picked from the model ID: a lowercase org (qwen/qwen3.5-9b) or a :free suffix means OpenRouter (when OPENROUTER_API_KEY is set); otherwise Nebius.

### Fleet control plane (backend/)

| Variable | Default | Purpose |
|----------|---------|---------|
| DATABASE_URL | — (required) | Postgres connection string with db/schema.sql applied |
| DATABASE_POOL_MAX | 10 | Max pool connections |
| CORS_ORIGINS | http://localhost:5173,http://localhost:3000 | Allowed browser origins |
| CRED_API_KEY | — | Enables Cred credit checks on the control plane's /v1 routes; unset disables credits |
| CRED_API_BASE | Cred's hosted API | Cred API base URL |
| CRED_CREDIT_TYPE_ID | — | Cred credit type to charge |
| CRED_APP_ORIGIN | https://openeye.sh | Origin sent to Cred |

See backend/.env.example.

### Website (self-hosting openeye.sh)

Only needed if you run the website and its api/ functions yourself (vercel dev). See .env.example in the repository root.

| Variable | Purpose |
|----------|---------|
| DATABASE_URL, DATABASE_URL_UNPOOLED | Neon/Postgres for auth, dashboard data, and /v1 usage |
| BETTER_AUTH_SECRET, BETTER_AUTH_URL | Better Auth signing secret and public origin |
| GOOGLE_CLIENT_ID/SECRET, APPLE_CLIENT_ID/SECRET | Optional Google and Apple sign-in (each enabled only when both values are set) |
| VITE_AUTH_PROVIDERS | Which social buttons the login page shows, e.g. google,apple |
| ONEPROFILE_CLIENT_ID, ONEPROFILE_ISSUER | Override the built-in 1Profile OAuth client |
| CRED_API_KEY, CRED_CREDIT_TYPE_ID, CRED_API_BASE, CRED_APP_ORIGIN | Cred credits; billing is off when CRED_API_KEY is unset |
| OPENEYE_CREDITS_DISABLED | true turns billing off (previews only) |
| OPENROUTER_API_KEY, OPENROUTER_VLM_MODEL | Enable POST /v1/describe (default model qwen/qwen2.5-vl-72b-instruct) |
| BLOB_READ_WRITE_TOKEN | Vercel Blob for avatar uploads |
| VITE_DEPLOY_ENV | cloud or local, to override dashboard mode detection |

### Runtime configs (backend)

Backend runtime configs (backend/config/*.json5) can reference environment variables. ${ENV_VAR} and ${ENV_VAR:-default} are substituted at load time by runtime.env.load_env_vars(). The shipped configs use OPENAI_API_KEY, NEBIUS_API_KEY, and similar keys this way; backend/.env.example lists them.

### Schema Validation

Configs are validated against JSON schemas in backend/config/schema/:

- single_mode_schema.json — Single-mode configs
- multi_mode_schema.json — Multi-mode configs
