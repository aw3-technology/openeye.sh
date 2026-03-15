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
  /** Create or get user in Cred (POST /users) */
  syncUser(email?: string, name?: string) {
    return request<{ user: unknown; created: boolean }>("users", {
      method: "POST",
      body: JSON.stringify({
        email,
        name,
      }),
    });
  },

  /** GET /balance?user_id=... or ?email=... */
  getBalance(email?: string) {
    const param = email ? `email=${encodeURIComponent(email)}` : "";
    return request<CreditBalance>(`balance${param ? `?${param}` : ""}`);
  },

  /** POST /deduct */
  deduct(amount: number, description: string, creditTypeId?: string) {
    return request<{ success: boolean; new_balance: number }>("deduct", {
      method: "POST",
      body: JSON.stringify({
        amount,
        reason: description,
        ...(creditTypeId ? { credit_type_id: creditTypeId } : {}),
      }),
    });
  },

  /** POST /issue (refund / add credits) */
  issue(amount: number, description: string, creditTypeId?: string) {
    return request<{ success: boolean; new_balance: number }>("issue", {
      method: "POST",
      body: JSON.stringify({
        amount,
        reason: description,
        ...(creditTypeId ? { credit_type_id: creditTypeId } : {}),
      }),
    });
  },

  /** POST /checkout → routed to hosted-checkout by proxy */
  createCheckout(tierId: string, successUrl: string, cancelUrl: string, userEmail?: string) {
    return request<CheckoutSession>("checkout", {
      method: "POST",
      body: JSON.stringify({
        pricing_tier_id: tierId,
        user_email: userEmail,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });
  },

  /** GET /pricing-tiers */
  getPricingTiers() {
    return request<{ pricing_tiers: PricingTier[] }>("pricing-tiers");
  },

  /** GET /transactions */
  getTransactions(page = 0, pageSize = 20) {
    return request<{ data: CreditTransaction[]; count: number }>(
      `transactions?offset=${page * pageSize}&limit=${pageSize}`,
    );
  },
};
