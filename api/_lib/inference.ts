/**
 * Metered hosted inference shared by the REST API (api/v1.ts) and the remote
 * MCP server (api/mcp.ts): per-key rate limit, Cred credit charge with refund
 * on failure, and api_usage_log rows, so both surfaces bill the same way.
 */
import type { ServerResponse } from "node:http";
import { pool } from "./db.js";
import type { ApiKeyContext } from "./api-key-auth.js";
import { CREDIT_COSTS, deduct, getBalance, refund } from "./credits.js";
import { decodeImage, detect } from "./yolo.js";
import { HttpError } from "./http.js";

const RATE_WINDOW_SECONDS = 60;
const MAX_PROMPT_LENGTH = 2000;
export const VLM_MODEL = process.env.OPENROUTER_VLM_MODEL || "qwen/qwen2.5-vl-72b-instruct";

export const vlmConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);

export function models() {
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

/**
 * Counts this key's calls in the last minute (or, without a key, the user's
 * keyless calls); throws 429 when over its limit. Sets X-RateLimit-* on `res` when given.
 */
export async function enforceRateLimit(ctx: ApiKeyContext, res?: ServerResponse) {
  const { rows } = ctx.apiKeyId
    ? await pool.query(
        `select count(*)::int as n from api_usage_log
          where api_key_id = $1 and created_at > now() - make_interval(secs => $2)`,
        [ctx.apiKeyId, RATE_WINDOW_SECONDS],
      )
    : await pool.query(
        `select count(*)::int as n from api_usage_log
          where user_id = $1 and api_key_id is null and created_at > now() - make_interval(secs => $2)`,
        [ctx.userId, RATE_WINDOW_SECONDS],
      );
  const used = rows[0].n as number;
  const remaining = Math.max(0, ctx.rateLimit - used - 1);
  res?.setHeader("X-RateLimit-Limit", String(ctx.rateLimit));
  res?.setHeader("X-RateLimit-Remaining", String(remaining));
  if (used >= ctx.rateLimit) {
    res?.setHeader("Retry-After", String(RATE_WINDOW_SECONDS));
    throw new HttpError(429, `Rate limit exceeded (${ctx.rateLimit} requests per minute)`);
  }
}

/** Best-effort: a logging failure never fails a call the user was charged for. */
export async function logUsage(
  ctx: ApiKeyContext,
  endpoint: string,
  model: string | null,
  credits: number,
  ms: number | null,
  status: number,
) {
  try {
    await pool.query(
      `insert into api_usage_log (api_key_id, user_id, endpoint, model, credits_used, inference_ms, status_code, user_agent)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [ctx.apiKeyId, ctx.userId, endpoint, model, credits, ms, status, ctx.userAgent],
    );
  } catch (err) {
    console.error("[api/v1] usage log failed", err);
  }
}

/** Charges, runs, and logs the call; refunds if `run` throws. The caller has already rate limited. */
async function metered<T extends { inference_ms: number }>(
  ctx: ApiKeyContext,
  endpoint: string,
  model: string,
  cost: number,
  run: () => Promise<T>,
) {
  const user = { id: ctx.userId, email: ctx.email, emailVerified: ctx.emailVerified };
  const source = await deduct(user, cost, `OpenEye API ${endpoint}`);
  if (!source) {
    throw new HttpError(
      402,
      "Not enough credits (new accounts start with none). Buy credits at https://openeye.sh/dashboard/settings/credits",
    );
  }
  let result: T;
  try {
    result = await run();
  } catch (err) {
    await refund(user, cost, `Refund: ${endpoint} failed`, source);
    throw err;
  }
  await logUsage(ctx, endpoint, model, cost, result.inference_ms, 200);
  return { ...result, credits_used: cost };
}

/** Object detection on an encoded JPEG/PNG. `endpoint` is what api_usage_log records. */
export async function runDetect(ctx: ApiKeyContext, bytes: Buffer, confidence: number, endpoint = "/v1/detect") {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new HttpError(400, "confidence must be between 0 and 1");
  }
  const image = decodeImage(bytes);
  return metered(ctx, endpoint, "yolov8", CREDIT_COSTS.detect, async () => {
    const { objects, inferenceMs } = await detect(image, confidence);
    return {
      model: "yolov8",
      objects,
      image: { width: image.width, height: image.height },
      inference_ms: Math.round(inferenceMs * 100) / 100,
    };
  });
}

/** Scene description on an encoded JPEG/PNG. `endpoint` is what api_usage_log records. */
export async function runDescribe(ctx: ApiKeyContext, bytes: Buffer, prompt: string | undefined, endpoint = "/v1/describe") {
  if (!vlmConfigured()) throw new HttpError(503, "Scene description isn't enabled on the hosted API yet");
  prompt ||= "Describe what you see in this image.";
  if (prompt.length > MAX_PROMPT_LENGTH) throw new HttpError(400, `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)`);
  const image = decodeImage(bytes);
  const mime = bytes[0] === 0x89 ? "image/png" : "image/jpeg";

  return metered(ctx, endpoint, VLM_MODEL, CREDIT_COSTS.describe, async () => {
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
              { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } },
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

export async function usage(ctx: ApiKeyContext, requestedDays: number) {
  const days = Math.min(Math.max(requestedDays || 30, 1), 365);
  const [{ rows: totals }, { rows: byEndpoint }, { rows: byDay }] = await Promise.all([
    pool.query(
      `select count(*)::int as requests, coalesce(sum(credits_used), 0)::int as credits
         from api_usage_log where user_id = $1 and status_code = 200 and created_at > now() - make_interval(days => $2)`,
      [ctx.userId, days],
    ),
    pool.query(
      `select endpoint, count(*)::int as n from api_usage_log
        where user_id = $1 and status_code = 200 and created_at > now() - make_interval(days => $2) group by endpoint`,
      [ctx.userId, days],
    ),
    pool.query(
      `select to_char(created_at, 'YYYY-MM-DD') as day, sum(credits_used)::int as credits from api_usage_log
        where user_id = $1 and status_code = 200 and created_at > now() - make_interval(days => $2) group by 1 order by 1`,
      [ctx.userId, days],
    ),
  ]);
  const balance = await getBalance({ id: ctx.userId, email: ctx.email, emailVerified: ctx.emailVerified }).catch(() => null);
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
