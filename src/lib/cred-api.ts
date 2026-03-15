import type {
  CreditBalance,
  CreditTransaction,
  PricingTier,
  CheckoutSession,
} from "@/types/credits";
import { supabase } from "@/integrations/supabase/client";

const REQUEST_TIMEOUT_MS = 15_000;

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function request<T>(
  subPath: string,
  options?: RequestInit,
): Promise<T> {
  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (options?.signal) {
    if (options.signal.aborted) controller.abort(options.signal.reason);
    else options.signal.addEventListener("abort", () => controller.abort(options.signal!.reason), { once: true });
  }

  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/cred-proxy/${subPath}`;

    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(options?.headers as Record<string, string> || {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`cred API error ${res.status}: ${body}`);
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
  syncUser() {
    return request<{ ok: boolean }>("sync-user", { method: "POST" });
  },

  getBalance() {
    return request<CreditBalance>("balance");
  },

  deduct(amount: number, description: string) {
    return request<CreditBalance>("deduct", {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    });
  },

  refund(amount: number, description: string) {
    return request<CreditBalance>("refund", {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    });
  },

  createCheckout(tierId: string, successUrl: string, cancelUrl: string) {
    return request<CheckoutSession>("checkout", {
      method: "POST",
      body: JSON.stringify({
        tier_id: tierId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });
  },

  getPricingTiers() {
    return request<PricingTier[]>("tiers");
  },

  getTransactions(page = 0, pageSize = 20) {
    return request<{ data: CreditTransaction[]; count: number }>(
      `transactions?offset=${page * pageSize}&limit=${pageSize}`,
    );
  },
};
