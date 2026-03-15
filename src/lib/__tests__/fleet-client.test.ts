import { describe, it, expect, vi, afterEach } from "vitest";
import { FleetClient, getStoredFleetUrl, setStoredFleetUrl } from "../fleet-client";

const BASE_URL = "http://localhost:8001";
const TOKEN = "test-jwt-token";

function mockFetchOk(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockFetch204() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    json: () => Promise.reject(new Error("no body")),
  });
}

function mockFetchError(status: number, detail: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ detail }),
  });
}

describe("FleetClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends Authorization header", async () => {
    const fetchMock = mockFetchOk([]);
    globalThis.fetch = fetchMock;
    const client = new FleetClient(BASE_URL, TOKEN);

    await client.listDevices();

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("listDevices builds query string from params", async () => {
    const fetchMock = mockFetchOk([]);
    globalThis.fetch = fetchMock;
    const client = new FleetClient(BASE_URL, TOKEN);

    await client.listDevices({ status: "online", device_type: "camera" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("status=online");
    expect(url).toContain("device_type=camera");
  });

  it("registerDevice sends POST", async () => {
    const fetchMock = mockFetchOk({ id: "dev-1" });
    globalThis.fetch = fetchMock;
    const client = new FleetClient(BASE_URL, TOKEN);

    await client.registerDevice({ name: "test", device_type: "edge_node" } as any);

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe("POST");
  });

  it("handles 204 response for delete operations", async () => {
    globalThis.fetch = mockFetch204();
    const client = new FleetClient(BASE_URL, TOKEN);

    const result = await client.deleteGroup("group-1");
    expect(result).toBeUndefined();
  });

  it("throws descriptive error on HTTP failure", async () => {
    globalThis.fetch = mockFetchError(404, "Device not found");
    const client = new FleetClient(BASE_URL, TOKEN);

    await expect(client.getDevice("bad-id")).rejects.toThrow("Device not found");
  });

  it("times out long requests", async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      (_, opts) =>
        new Promise((_, reject) => {
          // Simulate the AbortController timeout
          opts?.signal?.addEventListener("abort", () => {
            reject(new DOMException("signal is aborted", "AbortError"));
          });
        }),
    );
    const client = new FleetClient(BASE_URL, TOKEN);

    await expect(client.listDevices()).rejects.toThrow("timed out");
  }, 15_000);
});

describe("Fleet URL storage", () => {
  it("returns default URL when nothing stored", () => {
    localStorage.removeItem("openeye_fleet_url");
    expect(getStoredFleetUrl()).toBe("http://localhost:8001");
  });

  it("stores and retrieves custom URL", () => {
    setStoredFleetUrl("http://custom:9000");
    expect(getStoredFleetUrl()).toBe("http://custom:9000");
    localStorage.removeItem("openeye_fleet_url");
  });
});
