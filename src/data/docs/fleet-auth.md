---
title: Fleet Authentication
---

Fleet management works two ways:

- On openeye.sh — the dashboard's Fleet pages store devices, deployments, groups, maintenance windows, alerts, and device commands in your account through the website's own API. Nothing to host. Registering a device there shows its oek_ device key once.
- Self-hosted control plane — run the FastAPI fleet control plane from backend/ (port 8001) against your own Postgres database, and drive it with openeye fleet or a locally run dashboard. This is what edge devices running openeye fleet agent talk to. OpenEye doesn't host a control plane for you.

The hosted dashboard at openeye.sh always uses its own API; it does not connect to a self-hosted control plane. Commands queued from the hosted dashboard are stored for your devices, and delivering them needs a control plane connected to the same database.

### Self-host the control plane

You need any Postgres database (Neon works well) with the OpenEye schema applied:

```bash
# from the repo root; reads DATABASE_URL_UNPOOLED, else DATABASE_URL, from .env.local
npm run db:migrate
# or
psql "$DATABASE_URL" -f db/schema.sql
```

Then start the app factory from backend/src:

```bash
pip install -e backend/ --group dev
export DATABASE_URL="postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
cd backend/src
uvicorn fleet.app:create_fleet_app --factory --host 0.0.0.0 --port 8001
curl http://localhost:8001/health
```

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| DATABASE_URL | Yes | — | Postgres connection string (pooled endpoint recommended) |
| DATABASE_POOL_MAX | No | 10 | Max pool connections |
| CORS_ORIGINS | No | http://localhost:5173,http://localhost:3000 | Browser origins allowed; add http://localhost:8080 for the local dashboard |
| CRED_API_KEY | No | — | Enables credit checks on the control plane's /v1 routes; unset means credits are disabled |
| CRED_API_BASE, CRED_CREDIT_TYPE_ID, CRED_APP_ORIGIN | No | Cred defaults | Cred settings |

See backend/.env.example for a template.

### User sessions

Fleet routes (devices, deployments, groups, maintenance, alerts, OTA, commands) require a Better Auth session token: Authorization: Bearer <token>. The token is looked up in the session table of the control plane's database, so the user must have signed in to a copy of the website that uses the same DATABASE_URL (for example vercel dev locally, or your own deployment). Either the raw session token or the signed session cookie value works. oe_ API keys are not accepted on fleet routes.

For the CLI, export the token as OPENEYE_TOKEN and point OPENEYE_FLEET_URL at the control plane (default http://localhost:8001).

### Device API Keys

Each device gets a key starting with oek_ when it is registered (openeye fleet register, POST /devices, or the dashboard). The key is shown once and stored as a SHA-256 hash. Devices send it in the X-Device-API-Key header for heartbeats and command completion:

```bash
openeye fleet agent --device-id <uuid> --api-key oek_... --server http://control-plane:8001
```

The agent also reads the key from OPENEYE_DEVICE_API_KEY.

### API Keys on /v1

The control plane also serves the hosted-API routes under /v1 (detect, depth, describe, models, usage, plus a /v1/stream WebSocket). Those take a user API key: Authorization: Bearer oe_... or X-API-Key: oe_...
