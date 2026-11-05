/**
 * Hosted inference API at https://openeye.sh/v1 (vercel.json rewrites
 * /v1/* here). Same contract as the self-hosted control plane
 * (backend/src/fleet/routers/v1_api.py) and the `openeye api` CLI:
 *
 *   GET  /v1/models
 *   GET  /v1/usage?days=30
 *   POST /v1/detect     multipart: file, confidence (form or query)
 *   POST /v1/describe   multipart: file, prompt
 *   POST /v1/depth      not available on the hosted API yet
 *
 * Auth: `Authorization: Bearer oe_...` (keys from the dashboard). Each call
 * is rate limited per key, charged in Cred credits, and logged to api_usage_log.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { pool } from "./_lib/db.js";
import { requireApiKey, type ApiKeyContext } from "./_lib/api-key-auth.js";
import { CREDIT_COSTS, deduct, getBalance, refund } from "./_lib/credits.js";
import { readMultipart } from "./_lib/multipart.js";
import { decodeImage, detect } from "./_lib/yolo.js";
import { HttpError, handleError, pathSegments, restoreRewrittenUrl, sendJson } from "./_lib/http.js";

const RATE_WINDOW_SECONDS = 60;
const MAX_PROMPT_LENGTH = 2000;
const VLM_MODEL = process.env.OPENROUTER_VLM_MODEL || "qwen/qwen2.5-vl-72b-instruct";

const vlmConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);

function models() {
  return [
    {
      id: "yolov8",
      name: "YOLOv8 Nano",
      task: "detection",
      credits_per_call: CREDIT_COSTS.detect,
      description: "Real-time object detection with 80 COCO classes.",
      available: true,
    },
    {
      id: "qwen2.5-vl",
      name: "Qwen2.5-VL",
      task: "description",
      credits_per_call: CREDIT_COSTS.describe,
      description: "Scene description and visual Q&A.",
      available: vlmConfigured(),
    },
    {
      id: "depth-anything-v2",
      name: "Depth Anything V2",
      task: "depth",
      credits_per_call: CREDIT_COSTS.depth,
      description: "Monocular depth estimation. Self-hosted only for now (openeye serve).",
      available: false,
    },
  ];
}

/** Counts this key's calls in the last minute; throws 429 when over its limit. */
async function enforceRateLimit(ctx: ApiKeyContext, res: ServerResponse) {
  const { rows } = await pool.query(
    `select count(*)::int as n from api_usage_log
      where api_key_id = $1 and created_at > now() - make_interval(secs => $2)`,
    [ctx.apiKeyId, RATE_WINDOW_SECONDS],
  );
  const used = rows[0].n as number;
  const remaining = Math.max(0, ctx.rateLimit - used - 1);
  res.setHeader("X-RateLimit-Limit", String(ctx.rateLimit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  if (used >= ctx.rateLimit) {
    res.setHeader("Retry-After", String(RATE_WINDOW_SECONDS));
    throw new HttpError(429, `Rate limit exceeded (${ctx.rateLimit} requests per minute)`);
  }
}

async function logUsage(ctx: ApiKeyContext, endpoint: string, model: string, credits: number, ms: number | null, status: number) {
  await pool.query(
    `insert into api_usage_log (api_key_id, user_id, endpoint, model, credits_used, inference_ms, status_code)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [ctx.apiKeyId, ctx.userId, endpoint, model, credits, ms, status],
  );
}

/** Rate limit, then charge; refunds if `run` throws. */
async function metered<T extends { inference_ms: number }>(
  ctx: ApiKeyContext,
  res: ServerResponse,
  endpoint: string,
  model: string,
  cost: number,
  run: () => Promise<T>,
) {
  await enforceRateLimit(ctx, res);
  const user = { id: ctx.userId, email: ctx.email };
  if (!(await deduct(user, cost, `OpenEye API ${endpoint}`))) {
    throw new HttpError(402, "Not enough credits. Buy more at https://openeye.sh/dashboard/settings/credits");
  }
  let result: T;
  try {
    result = await run();
  } catch (err) {
    await refund(user, cost, `Refund: ${endpoint} failed`);
    throw err;
  }
  await logUsage(ctx, endpoint, model, cost, result.inference_ms, 200);
  return { ...result, credits_used: cost };
}

async function handleDetect(req: IncomingMessage, res: ServerResponse, ctx: ApiKeyContext, query: URLSearchParams) {
  const form = await readMultipart(req);
  if (!form.file) throw new HttpError(400, "Missing image: send it in a multipart field named file");
  const confidence = Number(form.fields.confidence ?? query.get("confidence") ?? 0.25);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new HttpError(400, "confidence must be between 0 and 1");
  }
  const image = decodeImage(form.file.data);
  return metered(ctx, res, "/v1/detect", "yolov8", CREDIT_COSTS.detect, async () => {
    const { objects, inferenceMs } = await detect(image, confidence);
    return {
      model: "yolov8",
      objects,
      image: { width: image.width, height: image.height },
      inference_ms: Math.round(inferenceMs * 100) / 100,
    };
  });
}

async function handleDescribe(req: IncomingMessage, res: ServerResponse, ctx: ApiKeyContext) {
  if (!vlmConfigured()) throw new HttpError(503, "Scene description isn't enabled on the hosted API yet");
  const form = await readMultipart(req);
  if (!form.file) throw new HttpError(400, "Missing image: send it in a multipart field named file");
  const prompt = form.fields.prompt || "Describe what you see in this image.";
  if (prompt.length > MAX_PROMPT_LENGTH) throw new HttpError(400, `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)`);
  const image = decodeImage(form.file.data);
  const mime = form.file.data[0] === 0x89 ? "image/png" : "image/jpeg";

  return metered(ctx, res, "/v1/describe", VLM_MODEL, CREDIT_COSTS.describe, async () => {
    const start = performance.now();
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://openeye.sh",
        "X-Title": "OpenEye",
      },
      body: JSON.stringify({
        model: VLM_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mime};base64,${form.file!.data.toString("base64")}` } },
            ],
          },
        ],
        max_tokens: 512,
      }),
    });
    if (!upstream.ok) throw new HttpError(502, `Vision model request failed (${upstream.status})`);
    const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
    return {
      model: VLM_MODEL,
      description: data.choices?.[0]?.message?.content?.trim() ?? "",
      image: { width: image.width, height: image.height },
      inference_ms: Math.round((performance.now() - start) * 100) / 100,
    };
  });
}

async function handleUsage(ctx: ApiKeyContext, query: URLSearchParams) {
  const days = Math.min(Math.max(Number(query.get("days")) || 30, 1), 365);
  const [{ rows: totals }, { rows: byEndpoint }, { rows: byDay }] = await Promise.all([
    pool.query(
      `select count(*)::int as requests, coalesce(sum(credits_used), 0)::int as credits
         from api_usage_log where user_id = $1 and created_at > now() - make_interval(days => $2)`,
      [ctx.userId, days],
    ),
    pool.query(
      `select endpoint, count(*)::int as n from api_usage_log
        where user_id = $1 and created_at > now() - make_interval(days => $2) group by endpoint`,
      [ctx.userId, days],
    ),
    pool.query(
      `select to_char(created_at, 'YYYY-MM-DD') as day, sum(credits_used)::int as credits from api_usage_log
        where user_id = $1 and created_at > now() - make_interval(days => $2) group by 1 order by 1`,
      [ctx.userId, days],
    ),
  ]);
  const balance = await getBalance({ id: ctx.userId, email: ctx.email }).catch(() => null);
  return {
    balance,
    credits_remaining: balance,
    total_requests: totals[0].requests,
    total_calls: totals[0].requests,
    total_credits_used: totals[0].credits,
    credits_used: totals[0].credits,
    by_endpoint: Object.fromEntries(byEndpoint.map((r) => [r.endpoint, r.n])),
    daily_credits: Object.fromEntries(byDay.map((r) => [r.day, r.credits])),
    truncated: false,
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  restoreRewrittenUrl(req, "/v1");
  try {
    const { segments, query } = pathSegments(req, "/v1");
    const route = `${req.method} /${segments.join("/")}`;
    const ctx = await requireApiKey(req);

    switch (route) {
      case "GET /models":
        return sendJson(res, 200, models());
      case "GET /usage":
        return sendJson(res, 200, await handleUsage(ctx, query));
      case "POST /detect":
        return sendJson(res, 200, await handleDetect(req, res, ctx, query));
      case "POST /describe":
        return sendJson(res, 200, await handleDescribe(req, res, ctx));
      case "POST /depth":
        throw new HttpError(501, "Depth isn't available on the hosted API yet. Run it with `openeye serve depth-anything`.");
      default:
        throw new HttpError(404, `No such endpoint: ${route}`);
    }
  } catch (err) {
    handleError(res, err, "api/v1");
  }
}
