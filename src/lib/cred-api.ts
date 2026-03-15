import type {
  CreditBalance,
  CreditTransaction,
  PricingTier,
  CheckoutSession,
} from "@/types/credits";

function getApiUrl(): string {
  const url = import.meta.env.VITE_CRED_API_URL;
  if (!url) throw new Error("VITE_CRED_API_URL is not configured");
  return url as string;
}

function getApiKey(): string {
  const key = import.meta.env.VITE_CRED_API_KEY;
  if (!key) throw new Error("VITE_CRED_API_KEY is not configured");
  return key as string;
}

function getProjectId(): string {
  const id = import.meta.env.VITE_CRED_PROJECT_ID;
  if (!id) throw new Error("VITE_CRED_PROJECT_ID is not configured");
  return id as string;
}

function headers(userToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey()}`,
    "x-user-token": userToken,
  };
}

const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(
  path: string,
  userToken: string,
  options?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (options?.signal) {
    if (options.signal.aborted) controller.abort(options.signal.reason);
    else options.signal.addEventListener("abort", () => controller.abort(options.signal!.reason), { once: true });
  }

  try {
    const res = await fetch(`${getApiUrl()}${path}`, {
      ...options,
      headers: { ...headers(userToken), ...options?.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`cred.diy API error ${res.status}: ${body}`);
    }
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (options?.signal?.aborted) throw new Error("Request aborted");
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const credApi = {
  syncUser(userToken: string) {
    return request<{ ok: boolean }>(
      `/projects/${getProjectId()}/sync-user`,
      userToken,
      { method: "POST" },
    );
  },

  getBalance(userToken: string) {
    return request<CreditBalance>(
      `/projects/${getProjectId()}/balance`,
      userToken,
    );
  },

  deduct(userToken: string, amount: number, description: string) {
    return request<CreditBalance>(
      `/projects/${getProjectId()}/deduct`,
      userToken,
      {
        method: "POST",
        body: JSON.stringify({ amount, description }),
      },
    );
  },

  refund(userToken: string, amount: number, description: string) {
    return request<CreditBalance>(
      `/projects/${getProjectId()}/refund`,
      userToken,
      {
        method: "POST",
        body: JSON.stringify({ amount, description }),
      },
    );
  },

  createCheckout(
    userToken: string,
    tierId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    return request<CheckoutSession>(
      `/projects/${getProjectId()}/checkout`,
      userToken,
      {
        method: "POST",
        body: JSON.stringify({
          tier_id: tierId,
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      },
    );
  },

  getPricingTiers(userToken: string) {
    return request<PricingTier[]>(
      `/projects/${getProjectId()}/tiers`,
      userToken,
    );
  },

  getTransactions(userToken: string, page = 0, pageSize = 20) {
    return request<{ data: CreditTransaction[]; count: number }>(
      `/projects/${getProjectId()}/transactions?offset=${page * pageSize}&limit=${pageSize}`,
      userToken,
    );
  },
};
