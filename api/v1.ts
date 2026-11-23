/**
 * Hosted inference API at https://openeye.sh/v1 (vercel.json rewrites
 * /v1/* here). Same contract as the self-hosted control plane
 * (backend/src/fleet/routers/v1_api.py) and the `openeye api` CLI:
 *
 *   GET  /v1          public index of these endpoints
 *   GET  /v1/models   public model catalog
 *   GET  /v1/usage?days=30
 *   POST /v1/detect     multipart: file, confidence (form or query)
 *   POST /v1/describe   multipart: file, prompt
 *   POST /v1/depth      not available on the hosted API yet
 *
 * Auth: `Authorization: Bearer oe_...` (keys from the dashboard) on everything
 * except the index and /models. Routing runs first, so unknown paths get 404
 * and wrong methods 405 without a key. Each inference call is rate limited per
 * key, charged in Cred credits, and logged to api_usage_log, failures included.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { requireApiKey, type ApiKeyContext } from "./_lib/api-key-auth.js";
import { readMultipart } from "./_lib/multipart.js";
import { enforceRateLimit, logUsage, models, runDescribe, runDetect, usage, VLM_MODEL, vlmConfigured } from "./_lib/inference.js";
import { HttpError, handleError, pathSegments, restoreRewrittenUrl, sendJson } from "./_lib/http.js";

async function handleDetect(req: IncomingMessage, ctx: ApiKeyContext, query: URLSearchParams) {
  const form = await readMultipart(req);
  if (!form.file) throw new HttpError(400, "Missing image: send it in a multipart field named file");
  return runDetect(ctx, form.file.data, Number(form.fields.confidence ?? query.get("confidence") ?? 0.25));
}

async function handleDescribe(req: IncomingMessage, ctx: ApiKeyContext) {
  // Answer 503 before reading the upload, as runDescribe would after.
  if (!vlmConfigured()) throw new HttpError(503, "Scene description isn't enabled on the hosted API yet");
  const form = await readMultipart(req);
  if (!form.file) throw new HttpError(400, "Missing image: send it in a multipart field named file");
  return runDescribe(ctx, form.file.data, form.fields.prompt);
}

const DOCS_URL = "https://openeye.sh/docs/cli-api";

function index() {
  return {
    name: "OpenEye hosted inference API",
    docs: DOCS_URL,
    auth: "Authorization: Bearer oe_... (create a key at https://openeye.sh/dashboard/settings/api-keys)",
    endpoints: Object.entries(ROUTES).map(([path, r]) => ({
      path: `/v1${path}`,
      methods: Object.keys(r.methods),
      auth: !r.public,
      description: r.description,
    })),
  };
}

type Handler = (req: IncomingMessage, ctx: ApiKeyContext, query: URLSearchParams) => Promise<unknown>;

interface Route {
  description: string;
  public?: boolean;
  /** Inference endpoints: rate limited and logged to api_usage_log. */
  metered?: { model: string };
  methods: Record<string, Handler>;
}

const ROUTES: Record<string, Route> = {
  "": { description: "This index", public: true, methods: { GET: async () => index() } },
  "/models": { description: "Model catalog", public: true, methods: { GET: async () => models() } },
  "/usage": { description: "Your usage and credit balance (?days=30)", methods: { GET: (_req, ctx, q) => usage(ctx, Number(q.get("days"))) } },
  "/detect": {
    description: "Object detection, multipart field file (+ confidence)",
    metered: { model: "yolov8" },
    methods: { POST: (req, ctx, q) => handleDetect(req, ctx, q) },
  },
  "/describe": {
    description: "Scene description, multipart field file (+ prompt)",
    metered: { model: VLM_MODEL },
    methods: { POST: (req, ctx) => handleDescribe(req, ctx) },
  },
  "/depth": {
    description: "Depth estimation (self-hosted only for now)",
    methods: {
      POST: async () => {
        throw new HttpError(501, "Depth isn't available on the hosted API yet. Run it with `openeye serve depth-anything`.");
      },
    },
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  restoreRewrittenUrl(req, "/v1");
  let ctx: ApiKeyContext | null = null;
  let path = "";
  try {
    const { segments, query } = pathSegments(req, "/v1");
    path = segments.length ? `/${segments.join("/")}` : "";
    const route = ROUTES[path];
    if (!route) throw new HttpError(404, `No such endpoint: /v1${path}. See GET /v1 or ${DOCS_URL}`);
    const method = req.method === "HEAD" ? "GET" : (req.method ?? "GET");
    const run = route.methods[method];
    if (!run) {
      res.setHeader("Allow", Object.keys(route.methods).join(", "));
      throw new HttpError(405, `${req.method} isn't supported on /v1${path}. Use ${Object.keys(route.methods).join(" or ")}.`);
    }
    if (route.public) return sendJson(res, 200, await run(req, null as unknown as ApiKeyContext, query));

    ctx = await requireApiKey(req);
    if (route.metered) await enforceRateLimit(ctx, res);
    return sendJson(res, 200, await run(req, ctx, query));
  } catch (err) {
    const metered = ROUTES[path]?.metered;
    const status = err instanceof HttpError ? err.status : 500;
    // A 429 isn't logged: rate-limited retries would otherwise keep the key over its limit.
    if (ctx && metered && status !== 429) {
      await logUsage(ctx, `/v1${path}`, metered.model, 0, null, status);
    }
    handleError(res, err, "api/v1");
  }
}
