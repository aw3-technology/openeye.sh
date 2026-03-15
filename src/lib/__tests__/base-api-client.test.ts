import { describe, it, expect, vi, afterEach } from "vitest";
import { BaseApiClient } from "../base-api-client";

class TestClient extends BaseApiClient {
  protected override defaultHeaders() {
    return { "X-Test": "true" };
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async getWithTimeout<T>(path: string, ms: number): Promise<T> {
    return this.request<T>(path, undefined, ms);
  }
}

describe("BaseApiClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("includes default headers in requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: "ok" }),
    });
    globalThis.fetch = fetchMock;

    const client = new TestClient("http://localhost");
    await client.get("/test");

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers["X-Test"]).toBe("true");
  });

  it("prepends baseUrl to path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    globalThis.fetch = fetchMock;

    const client = new TestClient("http://example.com");
    await client.get("/api/resource");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("http://example.com/api/resource");
  });

  it("returns undefined for 204 responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    const client = new TestClient("http://localhost");
    const result = await client.get("/delete");
    expect(result).toBeUndefined();
  });

  it("throws error with detail from JSON error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: () => Promise.resolve({ detail: "Access denied" }),
    });

    const client = new TestClient("http://localhost");
    await expect(client.get("/secret")).rejects.toThrow("Access denied");
  });

  it("throws timeout error for slow requests", async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      (_, opts) =>
        new Promise((_, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const client = new TestClient("http://localhost");
    // Use a very short timeout
    await expect(client.getWithTimeout("/slow", 50)).rejects.toThrow("timed out");
  });
});
