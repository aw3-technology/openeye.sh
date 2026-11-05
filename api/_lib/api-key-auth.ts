import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { pool } from "./db.js";
import { HttpError } from "./http.js";

export interface ApiKeyContext {
  apiKeyId: string;
  userId: string;
  email: string | null;
  rateLimit: number;
  scopes: string[];
}

/** Authenticates `Authorization: Bearer oe_...` against api_keys.key_hash (sha256). */
export async function requireApiKey(req: IncomingMessage): Promise<ApiKeyContext> {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  const key = scheme?.toLowerCase() === "bearer" ? token?.trim() : (req.headers["x-api-key"] as string | undefined);
  if (!key) throw new HttpError(401, "Missing API key. Send Authorization: Bearer oe_...");
  if (!key.startsWith("oe_")) throw new HttpError(401, "API keys start with oe_");

  const hash = createHash("sha256").update(key).digest("hex");
  const { rows } = await pool.query(
    `update api_keys k set last_used_at = now()
       from "user" u
      where k.key_hash = $1 and u.id = k.user_id
      returning k.id, k.user_id, k.rate_limit, k.scopes, u.email`,
    [hash],
  );
  const row = rows[0];
  if (!row) throw new HttpError(401, "Invalid API key");
  return {
    apiKeyId: row.id,
    userId: row.user_id,
    email: row.email,
    rateLimit: row.rate_limit ?? 60,
    scopes: row.scopes ?? ["inference"],
  };
}
