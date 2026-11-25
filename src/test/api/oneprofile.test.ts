// @vitest-environment node
// Server code: under jsdom, jose rejects byte arrays from jsdom's realm.
/**
 * api/_lib/oneprofile.ts: 1Profile AW3 access tokens (ZeusMCP) on the remote MCP
 * server. Verified with a locally generated RS256 key set instead of 1Profile's
 * JWKS; users resolve by linked sub, then verified email, then a new user.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey, type KeyLike } from "jose";

const query = vi.fn(async (_sql: string, _params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> => ({ rows: [] }));
const clientQuery = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }));
const release = vi.fn();
vi.mock("../../../api/_lib/db.js", () => ({
  pool: { query, connect: async () => ({ query: clientQuery, release }) },
}));

const { isOneProfileToken, ONEPROFILE_ISSUER, resolveOneProfileUser, verifyOneProfileAccess } = await import(
  "../../../api/_lib/oneprofile.ts"
);
const { default: handler } = await import("../../../api/mcp.ts");

const AUD = "https://openeye.sh/mcp";
let privateKey: KeyLike;
let keys: JWTVerifyGetKey;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test", alg: "RS256" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

const now = () => Math.floor(Date.now() / 1000);

function sign(claims: Record<string, unknown> = {}, opts: { exp?: number; iat?: number } = {}) {
  const iat = opts.iat ?? now();
  return new SignJWT({
    scope: "aw3",
    token_use: "access",
    azp: "client_f8291762631b48529bbe33b13e812eda",
    email: "Ada@Example.com",
    email_verified: true,
    name: "Ada",
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "test" })
    .setIssuer(ONEPROFILE_ISSUER)
    .setSubject("op-user-1")
    .setAudience(AUD)
    .setIssuedAt(iat)
    .setExpirationTime(opts.exp ?? iat + 300)
    .setJti("jti-1")
    .sign(privateKey);
}

// An unsigned JWT with the given header (alg none or a forged HS256 signature).
function forged(alg: string) {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const header = b64({ alg, typ: "JWT" });
  const payload = b64({
    iss: ONEPROFILE_ISSUER,
    sub: "op-user-1",
    aud: AUD,
    scope: "aw3",
    token_use: "access",
    iat: now(),
    exp: now() + 300,
  });
  return `${header}.${payload}.${alg === "none" ? "" : "c2lnbmF0dXJl"}`;
}

describe("isOneProfileToken", () => {
  it("recognizes a JWT issued by 1Profile and nothing else", async () => {
    expect(isOneProfileToken(await sign())).toBe(true);
    expect(isOneProfileToken("oe_abc123")).toBe(false);
    expect(isOneProfileToken("a.b.c")).toBe(false);
    const other = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://openeye.sh")
      .sign(privateKey);
    expect(isOneProfileToken(other)).toBe(false);
  });
});

describe("verifyOneProfileAccess", () => {
  it("accepts a valid AW3 access token and returns the identity", async () => {
    const identity = await verifyOneProfileAccess(await sign(), AUD, keys);
    expect(identity).toEqual({
      sub: "op-user-1",
      email: "Ada@Example.com",
      emailVerified: true,
      name: "Ada",
      picture: undefined,
    });
  });

  it("accepts any of several audiences", async () => {
    await expect(
      verifyOneProfileAccess(await sign(), ["https://other.example/mcp", AUD], keys),
    ).resolves.toMatchObject({ sub: "op-user-1" });
  });

  it("rejects a token for another audience", async () => {
    await expect(
      verifyOneProfileAccess(await sign(), "https://kanvo.ai/functions/v1/mcp/mcp", keys),
    ).rejects.toThrow();
  });

  it("rejects an id_token (audience is a client id)", async () => {
    const idToken = await new SignJWT({ email: "a@b.c" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(ONEPROFILE_ISSUER)
      .setSubject("op-user-1")
      .setAudience("dcr_3a11154ccf744d728573bf19c622acfd")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    await expect(verifyOneProfileAccess(idToken, AUD, keys)).rejects.toThrow();
  });

  it("rejects a token from another issuer", async () => {
    const token = await new SignJWT({ scope: "aw3", token_use: "access" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://evil.example/oauth")
      .setSubject("op-user-1")
      .setAudience(AUD)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    await expect(verifyOneProfileAccess(token, AUD, keys)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await sign({}, { iat: now() - 600, exp: now() - 300 });
    await expect(verifyOneProfileAccess(token, AUD, keys)).rejects.toThrow();
  });

  it("rejects a token without the aw3 scope", async () => {
    await expect(
      verifyOneProfileAccess(await sign({ scope: "openid email" }), AUD, keys),
    ).rejects.toThrow("not a 1Profile AW3 access token");
  });

  it("rejects a token whose token_use is not access", async () => {
    await expect(
      verifyOneProfileAccess(await sign({ token_use: "id" }), AUD, keys),
    ).rejects.toThrow("not a 1Profile AW3 access token");
  });

  it("rejects HS256 and alg none tokens", async () => {
    await expect(verifyOneProfileAccess(forged("HS256"), AUD, keys)).rejects.toThrow();
    await expect(verifyOneProfileAccess(forged("none"), AUD, keys)).rejects.toThrow();
  });

  it("rejects a token signed by a key not in the key set", async () => {
    const { privateKey: otherKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({ scope: "aw3", token_use: "access" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(ONEPROFILE_ISSUER)
      .setSubject("op-user-1")
      .setAudience(AUD)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(otherKey);
    await expect(verifyOneProfileAccess(token, AUD, keys)).rejects.toThrow();
  });
});

describe("resolveOneProfileUser", () => {
  beforeEach(() => {
    query.mockReset();
    clientQuery.mockReset();
    clientQuery.mockResolvedValue({ rows: [] });
  });
  const identity = { sub: "op-user-1", email: "Ada@Example.com", emailVerified: true, name: "Ada" };

  it("returns the user already linked to the 1Profile sub", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "u1", email: "ada@example.com" }] });
    expect(await resolveOneProfileUser(identity)).toEqual({ id: "u1", email: "ada@example.com" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(["1profile", "op-user-1"]);
  });

  it("links an existing verified user with the same email", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "u2", email: "ada@example.com", emailVerified: true }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await resolveOneProfileUser(identity)).toEqual({ id: "u2", email: "ada@example.com" });
    expect(query.mock.calls[1][1]).toEqual(["ada@example.com"]);
    const link = query.mock.calls[2];
    expect(link[0]).toContain('insert into "account"');
    expect(link[1]?.slice(1)).toEqual(["op-user-1", "1profile", "u2"]);
  });

  it("does not link when 1Profile didn't verify the email", async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: "u2", email: "ada@example.com", emailVerified: true }] });
    expect(await resolveOneProfileUser({ ...identity, emailVerified: false })).toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("creates a user and its 1profile account when none matches", async () => {
    query.mockResolvedValue({ rows: [] });
    const user = await resolveOneProfileUser(identity);
    expect(user?.email).toBe("ada@example.com");
    const sqls = clientQuery.mock.calls.map(([sql]) => sql);
    expect(sqls[0]).toBe("begin");
    expect(sqls[1]).toContain('insert into "user"');
    expect(sqls[2]).toContain('insert into "account"');
    expect(sqls[3]).toBe("commit");
    expect(release).toHaveBeenCalled();
  });
});

describe("remote MCP server with a 1Profile token", () => {
  it("answers 401 invalid_token for a 1Profile token it can't verify", async () => {
    const { Readable } = await import("node:stream");
    // HS256 is refused before any key lookup, so no JWKS fetch happens.
    const token = forged("HS256");
    const body = { jsonrpc: "2.0", id: 1, method: "tools/list" };
    const req = Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as import("node:http").IncomingMessage;
    Object.assign(req, { method: "POST", url: "/api/mcp", headers: { "content-type": "application/json", authorization: `Bearer ${token}` } });
    const res = {
      statusCode: 200,
      body: "",
      headers: {} as Record<string, string>,
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      end(chunk?: string) {
        this.body = chunk ?? "";
      },
    };
    await handler(req, res as unknown as import("node:http").ServerResponse);
    expect(res.statusCode).toBe(401);
    expect(res.headers["WWW-Authenticate"]).toMatch(/error="invalid_token"/);
  });
});
