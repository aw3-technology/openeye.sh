import type { IncomingMessage, ServerResponse } from "node:http";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export async function readRawBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "Request body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  const raw = await readRawBody(req, 1_000_000);
  if (raw.length === 0) return {} as T;
  try {
    return JSON.parse(raw.toString("utf8")) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

/** Returns the signed-in user, or throws 401. */
export async function requireUser(req: IncomingMessage) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new HttpError(401, "Not authenticated");
  return session.user;
}

/** Path segments after the given prefix, e.g. "/api/data/devices/1" → ["devices", "1"]. */
export function pathSegments(req: IncomingMessage, prefix: string): { segments: string[]; query: URLSearchParams } {
  const url = new URL(req.url || "/", "http://localhost");
  const rest = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : "";
  return {
    segments: rest.split("/").filter(Boolean).map(decodeURIComponent),
    query: url.searchParams,
  };
}

export function handleError(res: ServerResponse, err: unknown, tag: string) {
  if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
  // Postgres data (22xxx) and constraint (23xxx) errors are client mistakes.
  const code = (err as { code?: unknown })?.code;
  if (typeof code === "string" && /^2[23]/.test(code)) {
    return sendJson(res, code === "23505" ? 409 : 400, { error: (err as Error).message });
  }
  console.error(`[${tag}]`, err);
  sendJson(res, 500, { error: "Internal server error" });
}
