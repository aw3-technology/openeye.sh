---
title: Overview
---

OpenEye has four parts. You can use any of them on its own.

| Part | Where it runs | What it does |
|------|---------------|--------------|
| CLI and inference server (cli/) | Your machine | openeye pull, run, watch, bench, and serve; REST and WebSocket API on port 8000 |
| Hosted API (api/v1.ts) | openeye.sh, on Vercel | https://openeye.sh/v1 — YOLOv8n detection on CPU, API keys, Cred credits |
| Website and dashboard (src/, api/) | openeye.sh, on Vercel | Docs, sign-in, API keys, credits, history, fleet records; connects to your openeye serve for live work |
| Backend (backend/) | Your machine or servers | Perception pipeline, mode-based cortex runtime, governance engine, and the self-hosted fleet control plane on port 8001 |

### How the pieces connect

```text
 Browser ── https://openeye.sh ──► Vercel
   │                                ├─ /api/auth/*   Better Auth (email/password, 1Profile; Google/Apple optional)
   │                                ├─ /api/data/*   your dashboard data (owner-scoped)
   │                                ├─ /api/cred/*   credits via Cred
   │                                └─ /v1/*         hosted inference API ──► Neon Postgres
   │
   └── Server URL (Overview → Server) ──► openeye serve on localhost:8000
                                          (inference, live streams, scene graph, metrics,
                                           config, governance, MLOps, agent loop)

 Edge device ── openeye fleet agent ──► self-hosted fleet control plane :8001 ──► your Postgres
```

The website stores accounts, API keys, usage logs, inference history, observation memory, and fleet records in Neon Postgres (schema in db/schema.sql) and avatars in Vercel Blob. The dashboard's live pages don't run inference on openeye.sh: they call the openeye serve instance you point them at, and only the results you save (inference history, agent observations) go to your account. The hosted API is separate and billed per call.

### Backend runtime

The backend is a mode-based cortex runtime for autonomous perception and reasoning. It processes sensor inputs through a configurable pipeline:

```text
Inputs → Fuser → LLM Cortex → Actions → Outputs
```

The runtime operates in modes — distinct behavioral configurations. Each mode defines its own input sensors, LLM provider, actions, background tasks, and system prompt. Modes can transition based on input triggers, time, or context. Runtime configs live in backend/config/ (see Configuration).

### Further reading

- Perception Pipeline — detection, tracking, scene graphs, and the Safety Guardian
- Plugin System — inputs, LLM providers, and actions
- REST Endpoints and WebSocket — the openeye serve API
- Hosted API — the openeye.sh/v1 API
- Fleet Authentication — self-hosting the fleet control plane
