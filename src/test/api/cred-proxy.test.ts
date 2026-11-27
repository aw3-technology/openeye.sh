// @vitest-environment node
/**
 * api/cred.ts must only expose read/purchase routes and always use the
 * session's identity — never let the browser issue credits or read someone
 * else's balance.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";

vi.mock("../../../api/_lib/session.js", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "me@example.com", name: "Me" })),
}));

const { default: handler } = await import("../../../api/cred.ts");
const { requireUser } = await import("../../../api/_lib/session.js");

function call(method: string, url: string, body?: unknown) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []) as unknown as import("node:http").IncomingMessage;
  Object.assign(req, { method, url, headers: { "content-type": "application/json" } });
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
  return handler(req, res as unknown as import("node:http").ServerResponse).then(() => res);
}

describe("cred proxy", () => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }));

  beforeEach(() => {
    process.env.CRED_API_KEY = "server-key";
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("refuses to issue credits", async () => {
    const res = await call("POST", "/api/cred/issue", { amount: 1_000_000 });
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses browser-side deductions", async () => {
    const res = await call("POST", "/api/cred/deduct", { amount: 1 });
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses unknown and wrong-method routes", async () => {
    expect((await call("GET", "/api/cred/admin/users")).statusCode).toBe(404);
    expect((await call("POST", "/api/cred/balance")).statusCode).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the session email for balance, ignoring a spoofed one", async () => {
    await call("GET", "/api/cred/balance?email=victim@example.com&user_id=victim");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname.endsWith("/credits-api/balance")).toBe(true);
    expect(url.searchParams.get("email")).toBe("me@example.com");
    expect(url.searchParams.has("user_id")).toBe(false);
  });

  it("scopes transactions to the signed-in user", async () => {
    await call("GET", "/api/cred/transactions?offset=0&limit=20");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("email")).toBe("me@example.com");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("forces identity into user sync", async () => {
    await call("POST", "/api/cred/users", { external_id: "someone-else", user_id: "someone-else" });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.external_id).toBe("user-1");
    expect(body.user_id).toBe("user-1");
    expect(body.email).toBe("me@example.com");
  });

  describe("with Electrum on (ELECTRUM_ENABLED) and a verified email", () => {
    beforeEach(() => {
      process.env.ELECTRUM_ENABLED = "true";
      vi.mocked(requireUser).mockResolvedValue({ id: "user-1", email: "Me@Example.com", name: "Me", emailVerified: true } as never);
      fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    afterEach(() => {
      delete process.env.ELECTRUM_ENABLED;
      fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.mocked(requireUser).mockResolvedValue({ id: "user-1", email: "me@example.com", name: "Me" } as never);
    });

    it("sells only OpenEye's own packs (no Electrum packs listed or fetched)", async () => {
      fetchMock.mockImplementation(async () => new Response(JSON.stringify({ pricing_tiers: [{ id: "legacy-tier" }] }), { status: 200 }));
      const res = await call("GET", "/api/cred/pricing-tiers");
      expect(JSON.parse(res.body)).toEqual({ pricing_tiers: [{ id: "legacy-tier" }] });
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes("shared=true"))).toBe(false);
    });

    it("checks out exactly as before (never shared: true)", async () => {
      await call("POST", "/api/cred/checkout", { pricing_tier_id: "tier-elec-5" });
      const [, init] = fetchMock.mock.calls.find(([u]) => String(u).includes("hosted-checkout")) as [string, RequestInit];
      expect(JSON.parse(String(init.body)).shared).toBeUndefined();
    });

    it("reads the balance with include_shared", async () => {
      await call("GET", "/api/cred/balance");
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain("include_shared=true");
    });

    it("grants no Electrum on user sync", async () => {
      await call("POST", "/api/cred/users", {});
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/issue"))).toBe(false);
    });
  });
});
