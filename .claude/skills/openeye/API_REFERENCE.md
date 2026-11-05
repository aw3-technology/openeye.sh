# OpenEye API Reference

Five HTTP surfaces exist. Know which one you are talking to:

| Surface | Base URL | Code | Auth |
|---|---|---|---|
| Hosted inference API | `https://openeye.sh/v1` | `api/v1.ts` | `oe_` API key |
| Website server functions | `https://openeye.sh/api/{auth,data,cred}` | `api/auth.ts`, `api/data.ts`, `api/cred.ts` | Better Auth session cookie (same-origin) |
| Local server (`openeye serve`) | `http://localhost:8000` | `cli/openeye_ai/server/` | none (`/v1/*`: any `oe_` key, or `OPENEYE_SERVER_API_KEY`) |
| Fleet control plane (self-hosted) | `http://localhost:8001` | `backend/src/fleet/` | Better Auth session token, `oe_` key, or device key |
| gRPC perception service | `localhost:50051` | `backend/src/perception_grpc/` | none |

Routing for openeye.sh is in `vercel.json`: `/api/auth/*`, `/api/data/*`, `/api/cred/*` and `/v1/*` are rewritten to the functions (the sub-path is passed as `__path` and restored by `restoreRewrittenUrl`); everything else falls back to `index.html`.

---

## Hosted Inference API — `https://openeye.sh/v1` (`api/v1.ts`)

Auth: `Authorization: Bearer oe_...` or `X-API-Key: oe_...` (`api/_lib/api-key-auth.ts`). The key is SHA-256 hashed and looked up in `api_keys.key_hash`; `last_used_at` is updated. Keys are created in Dashboard → Settings → API Keys.

| Method | Path | Credits | Behavior |
|---|---|---|---|
| `GET` | `/v1/models` | 0 | Array: `yolov8` (available), `qwen2.5-vl` (available iff `OPENROUTER_API_KEY`), `depth-anything-v2` (available: false) |
| `POST` | `/v1/detect` | 1 | multipart `file`; `confidence` form field or query (0-1, default 0.25). YOLOv8n ONNX (COCO-80) on CPU via onnxruntime-web (`api/_lib/yolo.ts`) |
| `POST` | `/v1/describe` | 3 | multipart `file` + `prompt` (default "Describe what you see in this image.", max 2000 chars). OpenRouter, model `OPENROUTER_VLM_MODEL` (default `qwen/qwen2.5-vl-72b-instruct`), max_tokens 512. 503 when `OPENROUTER_API_KEY` is unset (current production state) |
| `POST` | `/v1/depth` | — | Always 501 on hosted ("Run it with `openeye serve depth-anything`") |
| `GET` | `/v1/usage?days=30` | 0 | `days` clamped to 1-365 |

Limits: multipart only (else 415); one file, < 4 MB (413, Vercel's body cap is 4.5 MB); JPEG or PNG only (415); max 25 megapixels (413). No WebSocket streaming on hosted.

Metering (`metered()` in `api/v1.ts`): rate-limit check → Cred deduct (402 if refused, including users with no Cred account) → run → on failure refund via Cred `issue` → log to `api_usage_log`. Rate limit: `api_keys.rate_limit` (default 60) calls per 60 s, counted from `api_usage_log`; sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` on 429. Credit costs: `CREDIT_COSTS = { detect: 1, depth: 2, describe: 3 }` (`api/_lib/credits.ts`). If `CRED_API_KEY` is unset or `OPENEYE_CREDITS_DISABLED=true`, billing is off (balance reads 0, every call allowed).

Responses:

```jsonc
// POST /v1/detect
{ "model": "yolov8", "objects": [{ "label": "person", "confidence": 0.92, "bbox": { "x": 0.12, "y": 0.08, "w": 0.35, "h": 0.8 } }],
  "image": { "width": 1280, "height": 720 }, "inference_ms": 180.5, "credits_used": 1 }
// POST /v1/describe
{ "model": "qwen/qwen2.5-vl-72b-instruct", "description": "...", "image": { "width": 1280, "height": 720 }, "inference_ms": 2100.4, "credits_used": 3 }
// GET /v1/usage
{ "balance": 847, "credits_remaining": 847, "total_requests": 153, "total_calls": 153,
  "total_credits_used": 180, "credits_used": 180, "by_endpoint": { "/v1/detect": 140 },
  "daily_credits": { "2026-11-04": 22 }, "truncated": false }
```

`bbox` is normalized 0-1 (`x`,`y` top-left, `w`,`h` size). Errors are `{ "error": "<message>" }` with 400, 401, 402, 404, 413, 415, 429, 501, 502 (upstream VLM failed), 503.

```bash
curl -s https://openeye.sh/v1/detect -H "Authorization: Bearer $OPENEYE_API_KEY" -F file=@photo.jpg -F confidence=0.3
openeye api detect photo.jpg --pretty      # same call from the CLI
```

---

## Website server functions

### `/api/auth/*` — Better Auth (`api/auth.ts`, config `api/_lib/auth.ts`)

- Email/password (min 6 chars), `genericOAuth` provider `1profile` (OIDC, public client with PKCE; "Continue with 1Profile"), Google and Apple only when `GOOGLE_CLIENT_ID/SECRET` / `APPLE_CLIENT_ID/SECRET` are set.
- Account linking across `1profile`, `google`, `apple` on the same email. Ids are UUIDs (`generateId: crypto.randomUUID`).
- Tables `user`, `session`, `account`, `verification` in `db/schema.sql`. `BETTER_AUTH_URL` should be `https://openeye.sh` in production.
- Browser client: `src/lib/auth-client.ts` (`authClient.signIn.email`, `signIn.social({ provider })`, `signUp.email`, `useSession`, `updateUser`, `listAccounts`, `signOut`). App context: `useAuth()` in `src/hooks/useAuth.tsx` (also provides demo mode).

### `/api/data/*` — owner-scoped CRUD (`api/data.ts`, allow-list `api/_lib/resources.ts`)

Every query is filtered by the session user's id (there is no database-level RLS). Only listed columns are writable/filterable; `user_id` is forced server-side; referenced ids (`refs`) must belong to the same user.

```
GET    /api/data/:resource?col=value&ids=a,b&limit=&offset=&count=1   → { data, count? }   (limit max 1000)
POST   /api/data/:resource              body: row          → 201 row
GET    /api/data/:resource/:id                             → row
PATCH  /api/data/:resource/:id          body: partial row  → row
DELETE /api/data/:resource/:id                             → { deleted: 1 }
DELETE /api/data/:resource?col=value    (a filter is required)  → { deleted: n }
POST   /api/data/avatar                 body: image bytes (PNG/JPEG/WebP/GIF, ≤ 2 MB) → { url }  (Vercel Blob)
```

| Resource | Filters | Notes |
|---|---|---|
| `devices` | `status`, `device_type` | POST returns the plaintext `api_key` (`oek_...`) once; only `api_key_hash` is stored and it is never returned |
| `device_resource_history` | `device_id` | |
| `device_commands` | `device_id`, `status` | `command_type` ∈ restart, update_config, deploy_model, rollback_model, ota_update, decommission, collect_logs; queued for the device agent |
| `deployments` | `status` | |
| `deployment_device_status` | `deployment_id`, `device_id` | |
| `device_groups` | — | includes computed `device_count` |
| `group_members` | `group_id`, `device_id` | |
| `maintenance_windows` | `is_active` | |
| `fleet_alerts` | `resolved`, `severity`, `device_id` | no create (written by the control plane); PATCH `resolved`/`resolved_at` only |
| `inference_history` | — | dashboard inference history |
| `observation_memory` | `session_id` | agent-loop observations (`tick`, `detections_json`, `scene_summary`, `change_description`, `significance`, `tags`) |
| `api_keys` | — | client generates the `oe_` key and posts `name`, `key_prefix`, `key_hash`; `key_hash` never returned |

Browser client: `src/lib/api.ts` → `api.list/get/create/update/remove/removeWhere/uploadAvatar`.

### `/api/cred/*` — Cred credits proxy (`api/cred.ts`)

Requires a session. Forwards to `${CRED_API_BASE}/credits-api/<path>` (or `/hosted-checkout`, `/presale-checkout`) with the server's `CRED_API_KEY`, forcing `user_id`/`email` in JSON bodies to the session user and injecting identity into `GET balance`. Filters balances to `CRED_CREDIT_TYPE_ID`. Browser client: `src/lib/cred-api.ts` (`credApi.syncUser`, `getBalance`, `deduct`, `issue`, `createCheckout`, `getPricingTiers`, `getTransactions`); hooks in `src/hooks/useCredits.ts`.

---

## Local Server — `openeye serve <model>` (default `0.0.0.0:8000`)

Factory `cli/openeye_ai/server/app.py`. CORS (`server/middleware.py`) allows `CORS_ORIGINS` (default `https://openeye.sh`, `https://www.openeye.sh`, `http://localhost:5173`, `:3000`, `:8080`) and answers Chrome Private Network Access preflights, so the hosted dashboard can call `http://localhost:8000`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Built-in browser dashboard |
| `GET` | `/health` | Model + status |
| `POST` | `/predict` | multipart `file`, optional `?prompt=` → `PredictionResult` |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/queue/status` | Inference queue (max 1 concurrent, 16 queued) |
| `GET`/`PUT` | `/config` | Runtime config |
| `POST` | `/perception` | Full perception frame |
| `POST` | `/vlm/analyze` | VLM analysis (OpenRouter or Nebius keys) |
| `GET` | `/nebius/stats` | Nebius usage |
| `POST` | `/v1/detect`, `/v1/depth`, `/v1/describe`; `GET` `/v1/models`, `/v1/usage` | Hosted-API-compatible routes; credits tracked in memory only |
| — | `/agent/start|stop|status|stream|memory|recall|demo/stream` | Agent loop |
| — | `/mlops/*`, `/governance/*` | MLOps and governance routers (governance mounted if importable) |
| `WS` | `/ws`, `/ws/perception`, `/ws/agentic`, `/ws/vlm` | Streaming |

### PredictionResult (`cli/openeye_ai/schema.py`)

```typescript
interface PredictionResult {
  model: string;
  task: string;
  timestamp: string;
  image: { width: number; height: number; source: string };
  objects: Array<{ label: string; confidence: number; bbox: { x: number; y: number; w: number; h: number } }>; // normalized 0-1
  depth_map?: string | null;          // base64 PNG (depth models)
  segmentation_masks?: Array<{ mask: string; area: number; bbox: BBox; stability_score: number }> | null; // sam2
  vla_action?: number[] | null;       // smolvla
  inference_ms: number;
}
```

---

## Fleet Control Plane — self-hosted (`backend/src/fleet/`, port 8001)

Start: `cd backend/src && DATABASE_URL=... uvicorn fleet.app:create_fleet_app --factory --port 8001`. Uses the same Postgres schema as the website (`db/schema.sql`), so devices registered in the dashboard are visible to it.

Auth (`auth_middleware.py`, `deps.py`): `Authorization: Bearer <Better Auth session token>` (raw token or signed cookie value), `Authorization: Bearer oe_...` / `X-API-Key: oe_...`, and `X-Device-API-Key: oek_...` for device routes. Per-IP rate limit on non-`/v1` routes.

| Prefix | Routes |
|---|---|
| `/devices` | `POST /`, `GET /` (`status`, `device_type`, `tag_key`, `tag_value`), `GET/PATCH/DELETE /{id}`, `PUT /{id}/tags`, `PUT /{id}/config`, `GET /{id}/resources`, `POST /{id}/restart`, `POST /batch` |
| `/heartbeats` | `POST /` (device key; returns pending commands) |
| `/commands` | `GET /` (`device_id`, `status`), `POST /{id}/complete`, `POST /{id}/device-complete` (device key) |
| `/deployments` | `POST /`, `GET /`, `GET /{id}`, `GET /{id}/devices`, `POST /{id}/advance`, `/pause`, `/rollback` |
| `/groups` | `POST /`, `GET /`, `GET/DELETE /{id}`, `POST/GET /{id}/members`, `DELETE /{id}/members/{device_id}`, `PUT /{id}/scaling` |
| `/maintenance` | `POST /`, `GET /` (`active_only`), `GET/PATCH/DELETE /{id}` |
| `/alerts` | `GET /` (`resolved`, `severity`), `POST /{id}/resolve` |
| `/ota` | `POST /update` |
| `/v1` | `POST /detect`, `/depth`, `/describe`; `GET /models`, `/usage`; `WS /v1/stream` (send `{"api_key": "oe_..."}` first; 1 credit per frame). Max image 20 MB. Credits via Cred if `CRED_API_KEY` is set |
| `/health` | `{"status": "ok", "service": "fleet-control-plane"}` |

---

## gRPC Perception Service (port 50051)

`backend/src/perception_grpc/perception_service.py`, service `openeye.PerceptionService`: `GetLatestDetections` (unary), `GetTelemetry` (unary), `StreamDetections` (server-streaming), `StreamTelemetry` (server-streaming).

```json
{ "frame_index": 42, "timestamp": 1710500000.123,
  "detections": [{ "label": "person", "confidence": 0.92, "bbox": { "x1": 0.1, "y1": 0.2, "x2": 0.5, "y2": 0.8 } }],
  "source": "camera_0", "inference_ms": 12.5, "capture_ms": 3.2 }
```

---

## Frontend client libraries (`src/lib/`)

| File | Talks to | Notes |
|---|---|---|
| `api.ts` | `/api/data` | Same-origin session cookie, 15 s timeout |
| `auth-client.ts` | `/api/auth` | Better Auth React client |
| `cred-api.ts` | `/api/cred` | Credits, checkout, transactions |
| `openeye-client.ts` | local `openeye serve` | `health`, `predict`, `getConfig`, `putConfig`, `vlmAnalyze`, `perception`, `nebiusStats`; `get/setStoredServerUrl` (localStorage) |
| `openeye-ws.ts` | local WebSockets | `new OpenEyeWebSocket(url, path = "/ws")`, auto-reconnect (10 attempts, 30 s cap) |
| `fleet-client.ts` | facade | `getFleetClient()` picks `CloudFleetClient` (`fleet-client-cloud.ts`, `/api/data`) on cloud hosts or `LocalFleetClient` (`fleet-client-local.ts`, fleet server URL) locally; interface in `fleet-client-interface.ts` |
| `deployment-env.ts` | — | `isCloudDeployment()`: `openeye.sh`, `www.openeye.sh`, `*.vercel.app`, or `VITE_DEPLOY_ENV=cloud|local` |
| `governance-client.ts`, `mlops-client.ts` | local server | `/governance/*`, `/mlops/*` |

## React hooks (`src/hooks/`)

| File | Hooks |
|---|---|
| `useAuth.tsx` | `useAuth()` → `{ user, loading, isDemo, signOut, signInAsDemo }` |
| `useOpenEyeConnection.tsx` | `useOpenEyeConnection()` — server URL, client, connection state |
| `useOpenEyeQueries.ts` | `useHealth`, `usePredict`, `useInferenceHistory`, `useSaveInference`, `useApiKeys`, `useDevices` |
| `useObservations.ts` | `useObservations`, `useSaveObservation` (`observation_memory`; sample data in demo mode) |
| `useCredits.ts` | `useCreditBalance`, `useDeductCredits`, `useIssueCredits`, `useCreateCheckout`, `usePricingTiers`, `useCreditTransactions`, `useSyncCredUser` |
| `useFleetQueries.ts` | devices, deployments, groups, maintenance, alerts, OTA, `useFleetSummary` (via `getFleetClient()`) |
| `useOpenEyeStream.tsx`, `usePerceptionStream.tsx`, `useAgentStream.ts`, `useVLMStream.ts`, `useVLMChannel.ts` | Live WebSocket streams to the local server |
| `useGovernanceQueries.ts`, `useMLOpsQueries.ts`, `useConfigEditor.ts` | Local server admin |
| `useInference.ts`, `useRecording.ts`, `useReplay.ts`, `usePerceptionMetrics.ts`, `usePerceptionSafety.ts`, `useSafetyDemoState.ts` | Inference/live-view helpers |

## Key types

- `src/types/fleet.ts`: `DeviceStatus` (pending, online, offline, maintenance, error, decommissioned), `DeviceType` (camera, robot, edge_node, gateway, drone), `DeploymentStrategy` (canary, rolling, blue_green, all_at_once), `DeploymentStatus`, `AlertSeverity`, `CommandType` (same 7 values as `COMMAND_TYPES`), `CommandStatus`.
- `src/types/openeye.ts`: `PredictionResult`, `PerformanceMetrics`, `ModelParameters`, `InferenceHistoryRow`, `ApiKeyRow`, `DeviceRow`.
- `src/types/credits.ts`: `CreditBalance`, `PricingTier`, `CheckoutSession`, `CreditTransaction`.
- `src/types/database.ts`: row types for the Neon tables.
