/**
 * Electrum, the credit shared by every AW3 app (1 Electrum = $1). cred.diy
 * supports it natively, so OpenEye uses its OWN cred key for everything:
 * `shared_fallback` on /deduct, `include_shared` on /balance, `shared: true` on
 * /refund (contract: ZeusMCP
 * obsidian/backend/aw3-credit.md). Mirrored in
 * backend/src/fleet/services/credits_service.py.
 *
 * Off unless ELECTRUM_ENABLED=true (server-only); unset, OpenEye bills exactly as
 * before. On, Electrum is only the spending fallback: it is sold on ZeusMCP, never
 * here, and OpenEye grants none. Only a verified email names the person's Electrum wallet.
 */

const CRED_API_BASE = process.env.CRED_API_BASE || "https://eutdgemlrpvnxfkkpvlu.supabase.co/functions/v1";
const APP_ORIGIN = process.env.CRED_APP_ORIGIN || "https://openeye.sh";
const TIMEOUT_MS = 5000;

/** Which balance paid for a charge (cred.diy's `paid_from`). */
export type CreditSource = "app" | "shared";

export const electrumEnabled = () => process.env.ELECTRUM_ENABLED === "true";

/** The Electrum wallet email: a verified email, trimmed and lowercased; null means OpenEye credits only. */
export function trustedEmail(email: string | null | undefined, verified: boolean | null | undefined) {
  const e = email?.trim().toLowerCase();
  return verified && e ? e : null;
}

/** The wallet email when Electrum applies to this user, else null. */
export const electrumEmail = (email: string | null | undefined, verified: boolean | null | undefined) =>
  electrumEnabled() ? trustedEmail(email, verified) : null;

type CredResult<T> = { ok: true; data: T } | { ok: false; status: number; code?: string };

/** A call with OpenEye's own key; failures are logged and returned, never thrown. */
export async function cred<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string } = {},
): Promise<CredResult<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": process.env.CRED_API_KEY ?? "",
    "x-app-origin": APP_ORIGIN,
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const method = init.method ?? "GET";
  try {
    const res = await fetch(`${CRED_API_BASE}/${path}`, {
      method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true, data: (await res.json().catch(() => ({}))) as T };
    const err = (await res.json().catch(() => ({}))) as { code?: string };
    if (res.status >= 500) console.error(`[electrum] ${method} ${path.split("?")[0]} [${res.status}]`, err);
    return { ok: false, status: res.status, code: err.code };
  } catch (err) {
    console.error(`[electrum] ${method} ${path.split("?")[0]} unreachable`, err);
    return { ok: false, status: 0 };
  }
}

/**
 * Refunds an Electrum-paid charge by its transaction id. No amount: the whole
 * charge goes back, in Electrum (the units it was paid in).
 */
export async function electrumRefund(transactionId: string, reason: string) {
  const res = await cred("credits-api/refund", {
    method: "POST",
    body: { transaction_id: transactionId, shared: true, reason },
  });
  return res.ok;
}
