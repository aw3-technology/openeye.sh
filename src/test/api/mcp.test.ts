/**
 * api/mcp.ts is the remote MCP server at https://openeye.sh/mcp. Agents must be
 * able to initialize and list tools without a key, keyed tools must explain how
 * to get one, and detection must bill and log like /v1 (with an /mcp endpoint).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

const query = vi.fn(async (_sql: string, _params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> => ({
  rows: [{ n: 0 }],
}));
vi.mock("../../../api/_lib/db.js", () => ({ pool: { query } }));
vi.mock("../../../api/_lib/auth.js", () => {
  throw new Error("api/mcp.ts must not import Better Auth");
});
const detect = vi.fn(async () => ({ objects: [{ label: "cat", confidence: 0.9 }], inferenceMs: 12 }));
vi.mock("../../../api/_lib/yolo.js", () => ({ decodeImage: vi.fn(() => ({ width: 2, height: 2 })), detect }));
const deduct = vi.fn(async () => true);
vi.mock("../../../api/_lib/credits.js", () => ({
  CREDIT_COSTS: { detect: 1, depth: 2, describe: 3 },
  deduct,
  refund: vi.fn(),
  getBalance: vi.fn(async () => 10),
}));

const { default: handler } = await import("../../../api/mcp.ts");

function call(body: unknown, headers: Record<string, string> = {}, method = "POST") {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as import("node:http").IncomingMessage;
  Object.assign(req, { method, url: "/api/mcp", headers: { "content-type": "application/json", ...headers } });
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
  return handler(req, res as unknown as import("node:http").ServerResponse).then(() => ({
    ...res,
    json: res.body ? JSON.parse(res.body) : null,
  }));
}

const rpc = (id: number, method: string, params?: unknown) => ({ jsonrpc: "2.0", id, method, params });
const PNG_B64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]).toString("base64");

describe("remote MCP server", () => {
  beforeEach(() => {
    query.mockClear();
    deduct.mockClear();
  });

  it("initializes without a key and echoes a supported protocol version", async () => {
    const res = await call(rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } }));
    expect(res.statusCode).toBe(200);
    expect(res.json.result.protocolVersion).toBe("2025-06-18");
    expect(res.json.result.capabilities.tools).toBeDefined();
    expect(res.json.result.serverInfo.name).toBe("openeye");
  });

  it("acknowledges notifications with 202 and no body", async () => {
    const res = await call({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.statusCode).toBe(202);
    expect(res.body).toBe("");
  });

  it("lists the hosted tools under the local server's names", async () => {
    const res = await call(rpc(2, "tools/list"));
    expect(res.json.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "openeye_api_detect",
      "openeye_api_describe",
      "openeye_api_models",
      "openeye_api_usage",
    ]);
  });

  it("serves the model catalog without a key", async () => {
    const res = await call(rpc(3, "tools/call", { name: "openeye_api_models", arguments: {} }));
    expect(res.json.result.isError).toBeUndefined();
    expect(res.json.result.structuredContent.models[0].id).toBe("yolov8");
  });

  it("returns a readable tool error, not an HTTP 401, when the key is missing", async () => {
    const res = await call(rpc(4, "tools/call", { name: "openeye_api_detect", arguments: { image_base64: PNG_B64 } }));
    expect(res.statusCode).toBe(200);
    expect(res.json.result.isError).toBe(true);
    expect(res.json.result.content[0].text).toMatch(/dashboard\/settings\/api-keys/);
    expect(deduct).not.toHaveBeenCalled();
  });

  it("charges and logs a detection under /mcp/detect", async () => {
    query.mockImplementation(async (sql: string) =>
      sql.includes("update api_keys")
        ? { rows: [{ id: "key-1", user_id: "user-1", rate_limit: 60, scopes: ["inference"], email: "me@example.com" }] }
        : { rows: [{ n: 0 }] },
    );
    const res = await call(rpc(5, "tools/call", { name: "openeye_api_detect", arguments: { image_base64: PNG_B64 } }), {
      authorization: "Bearer oe_test",
    });
    expect(res.json.result.isError).toBeUndefined();
    expect(res.json.result.structuredContent.objects[0].label).toBe("cat");
    expect(deduct).toHaveBeenCalledOnce();
    const insert = query.mock.calls.find(([sql]) => sql.includes("insert into api_usage_log"));
    expect(insert?.[1]?.[2]).toBe("/mcp/detect");
  });

  it("rejects private image URLs before fetching", async () => {
    query.mockImplementation(async (sql: string) =>
      sql.includes("update api_keys")
        ? { rows: [{ id: "key-1", user_id: "user-1", rate_limit: 60, scopes: ["inference"], email: null }] }
        : { rows: [{ n: 0 }] },
    );
    const res = await call(
      rpc(6, "tools/call", { name: "openeye_api_detect", arguments: { image_url: "http://169.254.169.254/latest" } }),
      { authorization: "Bearer oe_test" },
    );
    expect(res.json.result.isError).toBe(true);
    expect(res.json.result.content[0].text).toMatch(/public http/);
    expect(deduct).not.toHaveBeenCalled();
  });

  it("answers unknown methods with a JSON-RPC error and GET with 405", async () => {
    expect((await call(rpc(7, "resources/list"))).json.error.code).toBe(-32601);
    const get = await call(undefined, {}, "GET");
    expect(get.statusCode).toBe(405);
    expect(get.headers.Allow).toBe("POST");
  });
});
