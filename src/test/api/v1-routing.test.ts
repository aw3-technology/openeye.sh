/**
 * api/v1.ts must route before it authenticates (agents discover the API by
 * fetching /v1 without a key), and log failed inference calls so they count
 * toward the key's rate limit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

const query = vi.fn(async (_sql: string, _params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> => ({
  rows: [{ n: 0 }],
}));
vi.mock("../../../api/_lib/db.js", () => ({ pool: { query } }));
vi.mock("../../../api/_lib/auth.js", () => ({ auth: {} }));
vi.mock("../../../api/_lib/yolo.js", () => ({ decodeImage: vi.fn(), detect: vi.fn() }));

const { default: handler } = await import("../../../api/v1.ts");

function call(method: string, url: string, headers: Record<string, string> = {}) {
  const req = Readable.from([]) as unknown as import("node:http").IncomingMessage;
  Object.assign(req, { method, url, headers });
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

describe("hosted /v1 routing", () => {
  beforeEach(() => query.mockClear());

  it("serves a public index without a key", async () => {
    const res = await call("GET", "/api/v1?__path=");
    expect(res.statusCode).toBe(200);
    const paths = JSON.parse(res.body).endpoints.map((e: { path: string }) => e.path);
    expect(paths).toContain("/v1/detect");
    expect(query).not.toHaveBeenCalled();
  });

  it("serves the model catalog without a key", async () => {
    const res = await call("GET", "/api/v1?__path=models");
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).map((m: { id: string }) => m.id)).toContain("yolov8");
  });

  it("returns 404 / 405 before asking for a key", async () => {
    expect((await call("GET", "/api/v1?__path=nope")).statusCode).toBe(404);
    const wrong = await call("GET", "/api/v1?__path=detect");
    expect(wrong.statusCode).toBe(405);
    expect(wrong.headers.Allow).toBe("POST");
    expect(query).not.toHaveBeenCalled();
  });

  it("still requires a key for inference and usage", async () => {
    expect((await call("POST", "/api/v1?__path=detect")).statusCode).toBe(401);
    expect((await call("GET", "/api/v1?__path=usage")).statusCode).toBe(401);
  });

  it("logs a failed inference call with its status", async () => {
    query.mockImplementation(async (sql: string) =>
      String(sql).includes("update api_keys")
        ? { rows: [{ id: "key-1", user_id: "user-1", rate_limit: 60, scopes: ["inference"], email: null }] }
        : { rows: [{ n: 0 }] },
    );
    const res = await call("POST", "/api/v1?__path=detect", {
      authorization: "Bearer oe_test",
      "content-type": "multipart/form-data; boundary=x",
      "user-agent": "openeye-mcp/0.3.0",
    });
    expect(res.statusCode).toBe(400);
    const insert = query.mock.calls.find(([sql]) => String(sql).includes("insert into api_usage_log"));
    expect(insert?.[1]).toEqual(["key-1", "user-1", "/v1/detect", "yolov8", 0, null, 400, "openeye-mcp/0.3.0"]);
  });
});
