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

  describe("with Electrum (AW3 Credit) on and a verified email", () => {
    beforeEach(() => {
      process.env.AW3_CRED_API_KEY = "hub-key";
      process.env.AW3_CRED_CREDIT_TYPE_ID = "ct-aw3";
      process.env.AW3_CRED_PRICING_TIER_ID = "tier-aw3";
      vi.mocked(requireUser).mockResolvedValue({ id: "user-1", email: "Me@Example.com", name: "Me", emailVerified: true } as never);
    });
    afterEach(() => {
      delete process.env.AW3_CRED_API_KEY;
      delete process.env.AW3_CRED_CREDIT_TYPE_ID;
      delete process.env.AW3_CRED_PRICING_TIER_ID;
      vi.mocked(requireUser).mockResolvedValue({ id: "user-1", email: "me@example.com", name: "Me" } as never);
    });

    it("checks out the Electrum tier on the hub, whatever tier the browser sent", async () => {
      await call("POST", "/api/cred/checkout", { success_url: "https://openeye.sh/x", cancel_url: "https://openeye.sh/y" });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/hosted-checkout$/);
      expect((init.headers as Record<string, string>)["x-api-key"]).toBe("hub-key");
      const body = JSON.parse(String(init.body));
      expect(body.pricing_tier_id).toBe("tier-aw3");
      expect(body.user_id).toBe("me@example.com");
    });

    it("keeps a legacy tier's checkout on OpenEye's own project", async () => {
      await call("POST", "/api/cred/checkout", { pricing_tier_id: "legacy-tier" });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["x-api-key"]).toBe("server-key");
    });

    it("grants the welcome credits on user sync", async () => {
      await call("POST", "/api/cred/users", {});
      const hubCall = fetchMock.mock.calls.find(([, i]) => (i?.headers as Record<string, string>)["x-api-key"] === "hub-key");
      expect((hubCall?.[1]?.headers as Record<string, string>)["Idempotency-Key"]).toBe("aw3-welcome:me@example.com");
    });
  });
});
