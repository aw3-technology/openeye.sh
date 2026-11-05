---
name: openeye
description: Get context-aware help with the OpenEye vision AI platform — the openeye CLI and local server, the hosted API at openeye.sh/v1, the MCP server, the Vercel/Neon website and dashboard, and the self-hosted fleet control plane.
argument-hint: "<question about OpenEye>"
allowed-tools: Bash, Read, Glob, Grep, WebSearch, WebFetch, Agent
---

# OpenEye — Ollama for Vision AI

OpenEye has four parts that share one repo (`aw3-technology/openeye.sh`):

1. **CLI + local server** (`cli/`, PyPI `openeye-sh`, command `openeye`): pull, run, benchmark and serve vision models; `openeye serve` is a FastAPI server on :8000. Also ships the MCP server `openeye-mcp`.
2. **Website + dashboard + hosted API** (`src/` + `api/`): a Vite/React SPA on Vercel at https://openeye.sh. Server code is four Vercel functions in `api/`, backed by **Neon Postgres** (`db/schema.sql`) and Vercel Blob. The hosted inference API is `https://openeye.sh/v1`.
3. **Fleet control plane** (`backend/src/fleet/`): self-hosted FastAPI on :8001 using the same Postgres schema. Not deployed by us; users run it.
4. **Perception runtime** (`backend/src/`): OM1-derived pipeline, mode/cortex runtime, plugins, gRPC on :50051.

There is no Supabase and no Lovable in this project, and `api.openeye.ai` does not exist. Cred (credits) and 1Profile (sign-in) are third-party services.

## Project Structure

```
api/                          # Vercel functions (Node, TypeScript)
  auth.ts                     # Better Auth at /api/auth/*
  data.ts                     # Owner-scoped CRUD at /api/data/:resource (+ POST /api/data/avatar → Vercel Blob)
  cred.ts                     # Cred credits proxy at /api/cred/*
  v1.ts                       # Hosted inference API at /v1/* (YOLOv8n ONNX on CPU, OpenRouter VLM)
  _lib/                       # auth.ts (Better Auth config), resources.ts (table allow-list), db.ts (pg Pool),
                              # api-key-auth.ts, credits.ts, yolo.ts, multipart.ts, http.ts
db/schema.sql                 # Neon schema (Better Auth tables + app + fleet tables); `npm run db:migrate`
vercel.json                   # Rewrites /api/auth|data|cred/* and /v1/* to the functions; SPA fallback
models/yolov8n.onnx           # Bundled into api/v1.ts

src/                          # React frontend (Vite + TypeScript + Tailwind + shadcn/ui)
  App.tsx                     # Routes: public pages + /dashboard/*
  lib/                        # api.ts (/api/data client), auth-client.ts (Better Auth), cred-api.ts (/api/cred),
                              # openeye-client.ts / openeye-ws.ts (local `openeye serve`), fleet-client*.ts
  hooks/                      # useAuth, useOpenEyeConnection, useFleetQueries, useCredits, useObservations, ...
  pages/, pages/dashboard/, components/, content/blog/*.md, data/docs/

cli/                          # Python CLI + local server (Typer + FastAPI)
  openeye_ai/
    cli.py                    # Registers commands (implementations live in commands/)
    _cli_helpers.py           # OPENEYE_SERVER_URL / OPENEYE_API_URL / OPENEYE_FLEET_URL defaults
    commands/                 # models_*, inference/, server_cli, api_cli, agent_cli, fleet/, mlops/, governance/, docs
    models.yaml               # Bundled model registry
    adapters/                 # ModelAdapter implementations
    server/                   # app.py, routes/ (rest, v1, websockets), agent_router, middleware (CORS/PNA)
    mcp/                      # server.py (FastMCP tools), tools.py (runs the openeye binary)
  pyproject.toml              # scripts: openeye, openeye-mcp

backend/                      # Perception runtime + fleet control plane (Python 3.12)
  src/fleet/                  # FastAPI control plane (create_fleet_app factory), Postgres via DATABASE_URL
  src/perception/, perception_grpc/, runtime/, inputs/, llm/, actions/, governance/
  config/                     # JSON5 runtime configs + schemas

integrations/openclaw/        # OpenClaw skill for the hosted API
openclaw-skill/openeye/       # OpenClaw skill for the CLI
.mcp.json                     # Project MCP config for Claude Code (runs cli/.venv python -m openeye_ai.mcp.server)
```

## Quick Command Reference

```bash
# Models and inference (local)
openeye list                                   # available/downloaded models
openeye pull yolov8                            # download weights (--variant, --quantized, --all, --force)
openeye run yolov8 photo.jpg --pretty          # PredictionResult JSON (-c confidence, -o file, --visualize)
openeye run grounding-dino img.png -p "red car" # open-vocab detection
openeye bench yolov8 --runs 20
openeye serve yolov8                           # REST + WS on :8000
openeye remove yolov8                          # deletes weights — ask first

# Hosted API (needs OPENEYE_API_KEY=oe_...; default base https://openeye.sh)
openeye api models
openeye api detect photo.jpg --pretty
openeye api usage --days 7

# Fleet (self-hosted control plane; OPENEYE_FLEET_URL + OPENEYE_TOKEN)
openeye fleet register my-cam --type camera
openeye fleet ls --status online
openeye fleet deploy --name v2 --model yolov8 --version 2.0 --strategy canary

# Full reference, generated from the code
openeye docs            # or: openeye docs --json
```

Model keys (`cli/openeye_ai/models.yaml`): `yolov8`, `depth-anything`, `grounding-dino`, `yolo26`, `sam2`, `rfdetr`, `smolvla`. Keys use hyphens.

## Hosted API in one screen

Base `https://openeye.sh/v1`, `Authorization: Bearer oe_...` (or `X-API-Key`). Keys come from Dashboard → Settings → API Keys and are stored as SHA-256 hashes in `api_keys`.

| Endpoint | Credits | Status |
|---|---|---|
| `GET /v1/models` | 0 | live, includes `available` flags |
| `POST /v1/detect` (multipart `file`, `confidence`, default 0.25) | 1 | live, YOLOv8n COCO-80 on CPU |
| `POST /v1/describe` (multipart `file`, `prompt`) | 3 | returns 503 until `OPENROUTER_API_KEY` is set |
| `POST /v1/depth` | 2 | returns 501 on hosted; self-host with `openeye serve depth-anything` |
| `GET /v1/usage?days=30` | 0 | live |

JPEG/PNG under 4 MB. Rate limit defaults to 60/min per key (`api_keys.rate_limit`). Credits come from Cred via `api/_lib/credits.ts`; failures are refunded. No WebSocket streaming on hosted. Details: `API_REFERENCE.md`.

## MCP Server

`openeye-mcp` (entry point `openeye_ai.mcp.server:main`, stdio transport; install the `mcp` extra) exposes:

- Local tools (shell out to the `openeye` binary): `openeye_list`, `openeye_pull`, `openeye_run`, `openeye_serve`, `openeye_health`, `openeye_bench`, `openeye_remove`, `openeye_nebius_stats`
- Hosted-API tools (need `OPENEYE_API_KEY` in the MCP server's environment): `openeye_api_detect(image_path, confidence)`, `openeye_api_describe(image_path, prompt)`, `openeye_api_models()`, `openeye_api_usage(days)`

Client config (Claude Desktop, Cursor, or a user-level Claude Code config):

```json
{
  "mcpServers": {
    "openeye": {
      "command": "openeye-mcp",
      "env": { "OPENEYE_API_KEY": "oe_..." }
    }
  }
}
```

The repo's `.mcp.json` runs `cli/.venv/bin/python -m openeye_ai.mcp.server` from the repo root, so it needs a dev venv first: `python3.12 -m venv cli/.venv && cli/.venv/bin/pip install -e "cli/[all,mcp]"`. It sets no `env`, so the hosted-API tools only work if `OPENEYE_API_KEY` is exported in the shell that launched Claude Code.

## Environment Variables

CLI (`cli/openeye_ai/_cli_helpers.py` and commands):

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENEYE_SERVER_URL` | `http://localhost:8000` | Local `openeye serve` (health, server-config, agent) |
| `OPENEYE_API_URL` | `https://openeye.sh` | Hosted API base for `openeye api` |
| `OPENEYE_API_KEY` | — | `oe_` key for `openeye api` and MCP hosted tools |
| `OPENEYE_FLEET_URL` | `http://localhost:8001` | Fleet control plane |
| `OPENEYE_TOKEN` | — | Better Auth session token for `openeye fleet` |
| `OPENEYE_DEVICE_API_KEY` | — | Device key (`oek_...`) for `openeye fleet agent` |
| `OPENEYE_SERVER_API_KEY` | — | If set, the local server's `/v1/*` only accepts this key |
| `CORS_ORIGINS` | openeye.sh + localhost:5173/3000/8080 | Local server CORS |
| `OPENROUTER_API_KEY`, `NEBIUS_API_KEY`, `NEBIUS_MODEL` | — | VLM features of the local server |

Vercel functions (`api/`): `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ONEPROFILE_CLIENT_ID`/`ONEPROFILE_ISSUER` (optional overrides), `GOOGLE_CLIENT_ID`/`_SECRET` and `APPLE_CLIENT_ID`/`_SECRET` (providers are enabled only when set), `CRED_API_KEY`, `CRED_API_BASE`, `CRED_CREDIT_TYPE_ID`, `OPENEYE_CREDITS_DISABLED` (previews only), `OPENROUTER_API_KEY`, `OPENROUTER_VLM_MODEL`, `BLOB_READ_WRITE_TOKEN`.

Fleet backend (`backend/.env.example`): `DATABASE_URL`, `DATABASE_POOL_MAX`, `CRED_API_KEY`, `CRED_API_BASE`, `CRED_CREDIT_TYPE_ID`, `CRED_APP_ORIGIN`, `CORS_ORIGINS`.

## Build & Run Commands

```bash
# Frontend + Vercel functions
npm ci && npm run dev               # Vite dev server (port 8080)
vercel dev                          # Run SPA + api/ functions together (needs .env.local)
npm run db:migrate                  # Apply db/schema.sql to DATABASE_URL in .env.local
npm run build && npm run test && npm run lint

# CLI
pipx install "openeye-sh[all]"      # Released CLI
pip install -e "cli/[all,mcp]" --group dev   # Dev install (Makefile: make install-cli)
cd cli && python -m pytest -m "not integration"

# Fleet control plane (no module-level app; use the factory)
pip install -e backend/ --group dev
cd backend/src && DATABASE_URL=... uvicorn fleet.app:create_fleet_app --factory --port 8001

# Perception runtime
cd backend && python src/run.py openeye_vlm
```

## Dashboard behavior (https://openeye.sh/dashboard)

- Sign-in: Better Auth — email/password, "Continue with 1Profile" (always on), Google/Apple only when configured; plus a local demo mode with no account.
- Works without a local server (reads/writes `/api/data` and `/api/cred`): Overview, History, Export, API Keys, Credits, Profile, fleet CRUD, Observation Memory.
- Needs a connected `openeye serve` (Server URL dialog, default `http://localhost:8000`): Inference, Live, Scene Graph live, Metrics, Benchmark, Config editor, Governance, MLOps, Agent loop live mode.
- Cloud vs local mode: `src/lib/deployment-env.ts` (`openeye.sh` and `*.vercel.app` are cloud; override with `VITE_DEPLOY_ENV`). In cloud mode fleet pages use `/api/data`; in local mode they call the fleet server directly.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ImportError: ultralytics` | `pipx install "openeye-sh[yolo]"` (or `pipx inject openeye-sh ultralytics`) |
| `Model 'x' not found` | `openeye list`, then `openeye pull x` (hyphenated keys) |
| `Connection refused :8000` | Start `openeye serve <model>` or set `OPENEYE_SERVER_URL` |
| `Connection refused :8001` | Start the fleet control plane or set `OPENEYE_FLEET_URL` |
| `401` from `openeye fleet` | Set `OPENEYE_TOKEN` to a Better Auth session token |
| `401` from `/v1` | Key must start with `oe_` and exist in Dashboard → API Keys |
| `402` from `/v1` | Buy credits in Dashboard → Settings → Credits |
| Dashboard can't reach local server | Check the Server URL dialog; the server allows `https://openeye.sh` via CORS + Private Network Access |

## Safety Guidelines

- Never run `openeye remove` or `openeye fleet decommission` without user confirmation.
- Hosted API calls spend the user's credits: check `openeye api usage` before batches.
- Never print `oe_`/`oek_` keys or session tokens.
- Large pulls (`depth-anything`, `grounding-dino`, `sam2`, `smolvla`) take minutes and disk space — warn first.
- `openeye serve` runs in the foreground; background it explicitly.

## Detailed References

- `.claude/skills/openeye/CLI_REFERENCE.md` — every CLI command with options (generated from the Typer app)
- `.claude/skills/openeye/API_REFERENCE.md` — hosted `/v1`, `/api/*` functions, local server, fleet control plane, gRPC, frontend clients
- `.claude/skills/openeye/ARCHITECTURE.md` — platform architecture, data model, perception pipeline, runtime and plugins
