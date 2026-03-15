/**
 * Shared base for API clients — handles fetch, error parsing, timeout, and abort signal forwarding.
 */

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class BaseApiClient {
  constructor(public baseUrl: string) {}

  /** Override in subclasses to inject default headers (e.g. Authorization). */
  protected defaultHeaders(): Record<string, string> {
    return {};
  }

  protected async request<T>(path: string, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const callerSignal = init?.signal;
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort(callerSignal.reason);
      } else {
        callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason), { once: true });
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...this.defaultHeaders(), ...(init?.headers as Record<string, string> || {}) },
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        const message = body.detail || body.error || `HTTP ${res.status}`;
        if (res.status === 401 || res.status === 403) {
          throw new AuthenticationError(message);
        }
        throw new Error(message);
      }

      if (res.status === 204) return undefined as T;
      return await res.json();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (callerSignal?.aborted) throw new Error("Request aborted");
        throw new Error("Request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
