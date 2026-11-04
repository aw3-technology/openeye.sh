/**
 * Fetch helper for the owner-scoped data API (api/data/[...path].ts).
 * Auth is the Better Auth session cookie, so requests are same-origin only.
 */

const REQUEST_TIMEOUT_MS = 15_000;

export type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const qs = params.toString();
  return `/api/data/${path}${qs ? `?${qs}` : ""}`;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  options: { query?: Query; body?: unknown; rawBody?: BodyInit; contentType?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(path, options.query), {
      method,
      credentials: "same-origin",
      headers:
        options.rawBody !== undefined
          ? { "Content-Type": options.contentType || "application/octet-stream" }
          : options.body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
      body: options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new Error("Request timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  list: <T>(resource: string, query?: Query) =>
    apiRequest<{ data: T[]; count?: number }>("GET", resource, { query }),
  get: <T>(resource: string, id: string) => apiRequest<T>("GET", `${resource}/${id}`),
  create: <T>(resource: string, body: unknown) => apiRequest<T>("POST", resource, { body }),
  update: <T>(resource: string, id: string, body: unknown) => apiRequest<T>("PATCH", `${resource}/${id}`, { body }),
  remove: (resource: string, id: string) => apiRequest<{ deleted: number }>("DELETE", `${resource}/${id}`),
  removeWhere: (resource: string, query: Query) => apiRequest<{ deleted: number }>("DELETE", resource, { query }),
  uploadAvatar: (file: File) =>
    apiRequest<{ url: string }>("POST", "avatar", { rawBody: file, contentType: file.type }),
};
