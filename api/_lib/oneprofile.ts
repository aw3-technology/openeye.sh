/**
 * 1Profile-issued access tokens for the remote MCP server (the AW3 contract).
 * ZeusMCP trades a user's 1Profile token at 1Profile (RFC 8693 token exchange)
 * for a 5-minute RS256 JWT whose audience is https://openeye.sh/mcp and calls
 * /mcp with it. This recognizes and verifies those tokens and resolves the
 * OpenEye user they act as.
 *
 * Users are linked the way "Sign in with 1Profile" (Better Auth, api/_lib/auth.ts)
 * links them: an "account" row with providerId '1profile' and accountId = the
 * 1Profile sub. It's plain SQL so api/mcp.ts keeps Better Auth off its cold start.
 */
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { IncomingMessage } from "node:http";
import type { ApiKeyContext } from "./api-key-auth.js";
import { pool } from "./db.js";

export const ONEPROFILE_ISSUER = "https://lluoavnspwejosiuqymg.supabase.co/functions/v1/oauth";

/** The `aud` 1Profile AW3 tokens carry for this server. */
export const MCP_RESOURCE = "https://openeye.sh/mcp";

const PROVIDER_ID = "1profile";

let remoteJwks: JWTVerifyGetKey | undefined;
const oneProfileJwks = (): JWTVerifyGetKey =>
  (remoteJwks ??= createRemoteJWKSet(new URL(`${ONEPROFILE_ISSUER}/jwks`)));

/** True if the bearer value looks like a 1Profile-issued JWT (cheap, unverified). */
export function isOneProfileToken(token: string): boolean {
  if (token.split(".").length !== 3) return false;
  try {
    return decodeJwt(token).iss === ONEPROFILE_ISSUER;
  } catch {
    return false;
  }
}

export interface OneProfileIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Verifies a 1Profile AW3 access token for `resource`. Throws when the
 * signature, issuer, audience, expiry, algorithm, token_use or aw3 scope is
 * wrong. A 1Profile id_token fails the audience check (its aud is a client id).
 */
export async function verifyOneProfileAccess(
  token: string,
  resource: string | string[],
  keys: JWTVerifyGetKey = oneProfileJwks(),
): Promise<OneProfileIdentity> {
  const { payload } = await jwtVerify(token, keys, {
    issuer: ONEPROFILE_ISSUER,
    audience: resource,
    algorithms: ["RS256"],
  });
  const scopes = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
  if (payload.token_use !== "access" || !scopes.includes("aw3") || typeof payload.sub !== "string") {
    throw new Error("not a 1Profile AW3 access token");
  }
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

interface UserRow {
  id: string;
  email: string;
}

/**
 * The user a verified identity acts as, or null:
 * 1. the user with a 1profile account for this sub;
 * 2. else the user with the same email (case-insensitive), linked, when 1Profile
 *    verified the email and so did OpenEye (the rule Better Auth's sign-in
 *    callback applies with this app's config);
 * 3. else a new user + 1profile account, as the sign-in callback creates them.
 */
export async function resolveOneProfileUser(identity: OneProfileIdentity): Promise<UserRow | null> {
  const linked = await pool.query(
    `select u.id, u.email from "account" a join "user" u on u.id = a."userId"
      where a."providerId" = $1 and a."accountId" = $2 limit 1`,
    [PROVIDER_ID, identity.sub],
  );
  if (linked.rows[0]) return linked.rows[0] as UserRow;

  const email = identity.email?.trim().toLowerCase();
  if (!email) return null;
  const existing = await pool.query(`select id, email, "emailVerified" from "user" where lower(email) = $1 limit 1`, [email]);
  const found = existing.rows[0] as (UserRow & { emailVerified: boolean }) | undefined;
  if (found) {
    if (!identity.emailVerified || !found.emailVerified) return null;
    await pool.query(
      `insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, now(), now())`,
      [crypto.randomUUID(), identity.sub, PROVIDER_ID, found.id],
    );
    return { id: found.id, email: found.email };
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const id = crypto.randomUUID();
    await client.query(
      `insert into "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5, now(), now())`,
      [id, identity.name ?? "", email, identity.emailVerified, identity.picture ?? null],
    );
    await client.query(
      `insert into "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, now(), now())`,
      [crypto.randomUUID(), identity.sub, PROVIDER_ID, id],
    );
    await client.query("commit");
    return { id, email };
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Authenticates a 1Profile AW3 token for the MCP server: the same context an
 * API key gives (default key scopes and rate limit), with no key id. Throws on
 * any failure; the caller answers 401 invalid_token.
 */
export async function oneProfileContext(req: IncomingMessage, token: string): Promise<ApiKeyContext> {
  const identity = await verifyOneProfileAccess(token, MCP_RESOURCE);
  const user = await resolveOneProfileUser(identity);
  if (!user) throw new Error("no OpenEye user for this 1Profile account");
  return {
    apiKeyId: null,
    userId: user.id,
    email: user.email,
    // 1Profile verified this email for this user (email_verified).
    emailVerified: identity.emailVerified && user.email?.trim().toLowerCase() === identity.email?.trim().toLowerCase(),
    rateLimit: 60,
    scopes: ["inference"],
    userAgent: req.headers["user-agent"]?.slice(0, 300) ?? null,
  };
}
