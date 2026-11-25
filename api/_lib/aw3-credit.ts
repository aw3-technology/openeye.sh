/**
 * Electrum, the shared AW3 Credit, kept in the cred.diy "AW3 Wallet" hub project and
 * spendable in every AW3 app (contract: ZeusMCP obsidian/backend/aw3-credit.md).
 * Mirrored in backend/src/fleet/services/credits_service.py.
 *
 * On only when AW3_CRED_API_KEY, AW3_CRED_CREDIT_TYPE_ID and
 * AW3_CRED_PRICING_TIER_ID are all set (server-only); otherwise OpenEye bills
 * exactly as before. The hub wallet is keyed by a trusted (verified) email.
 * Hub failures never break a request: callers fall back to OpenEye's own credits.
 */

const CRED_API_BASE = process.env.CRED_API_BASE || "https://eutdgemlrpvnxfkkpvlu.supabase.co/functions/v1";
const APP_ORIGIN = process.env.CRED_APP_ORIGIN || "https://openeye.sh";

/** Prefix for every hub idempotency key, so AW3 apps can't collide. */
export const AW3_SLUG = "openeye";
const APP_NAME = "OpenEye";
const HUB_TIMEOUT_MS = 5000;
/** Same refusal statuses the legacy wrapper treats as "can't pay". */
const DENIED_STATUSES = new Set([400, 402, 404, 409, 422]);

/** Which balance paid for a charge; refunds go back to the same one. */
export type CreditSource = "app" | "aw3";

export function aw3Config() {
  const apiKey = process.env.AW3_CRED_API_KEY;
  const creditTypeId = process.env.AW3_CRED_CREDIT_TYPE_ID;
  const pricingTierId = process.env.AW3_CRED_PRICING_TIER_ID;
  if (!apiKey || !creditTypeId || !pricingTierId) return null;
  return { apiKey, creditTypeId, pricingTierId };
}

export const aw3Enabled = () => aw3Config() !== null;

/** The hub wallet key: a verified email, trimmed and lowercased; null means legacy only. */
export function trustedEmail(email: string | null | undefined, verified: boolean | null | undefined) {
  const e = email?.trim().toLowerCase();
  return verified && e ? e : null;
}

/** Hub reasons start with the app name ("OpenEye: API /v1/detect"). */
export function hubReason(reason: string) {
  return `${APP_NAME}: ${reason.replace(/^OpenEye:?\s*/, "")}`;
}

type HubResult<T> = { ok: true; data: T } | { ok: false; status: number; code?: string };

export async function hub<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string } = {},
): Promise<HubResult<T>> {
  const cfg = aw3Config();
  if (!cfg) return { ok: false, status: 0 };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": cfg.apiKey,
    "x-app-origin": APP_ORIGIN,
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const method = init.method ?? "GET";
  try {
    const res = await fetch(`${CRED_API_BASE}/${path}`, {
      method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true, data: (await res.json().catch(() => ({}))) as T };
    const err = (await res.json().catch(() => ({}))) as { code?: string };
    if (!DENIED_STATUSES.has(res.status)) console.error(`[aw3] ${method} ${path.split("?")[0]} [${res.status}]`, err);
    return { ok: false, status: res.status, code: err.code };
  } catch (err) {
    console.error(`[aw3] ${method} ${path.split("?")[0]} unreachable`, err);
    return { ok: false, status: 0 };
  }
}

type BalanceEntry = { credit_type_id?: string; balance?: number; credit_type_name?: string; credit_type_symbol?: string };

/** The AW3 Credit entry of a hub wallet, or null when the hub can't be read. */
export async function aw3BalanceEntry(email: string) {
  const cfg = aw3Config();
  if (!cfg) return null;
  const qs = new URLSearchParams({ email, credit_type_id: cfg.creditTypeId });
  const res = await hub<{ balances?: BalanceEntry[]; balance?: number }>(`credits-api/balance?${qs}`);
  // 404: no hub wallet yet, which is a zero balance.
  if (!("data" in res) && res.status !== 404) return null;
  const mine = ("data" in res ? res.data.balances : [])?.find((b) => b.credit_type_id === cfg.creditTypeId);
  return {
    credit_type_id: cfg.creditTypeId,
    credit_type_name: mine?.credit_type_name ?? "Electrum",
    credit_type_symbol: mine?.credit_type_symbol ?? "ELEC",
    balance: Number(mine?.balance ?? 0),
  };
}

export async function aw3Balance(email: string): Promise<number | null> {
  return (await aw3BalanceEntry(email))?.balance ?? null;
}

function mutation(email: string, amount: number, reason: string) {
  return {
    user_id: email,
    user_email: email,
    credit_type_id: aw3Config()!.creditTypeId,
    amount,
    reason: hubReason(reason),
  };
}

/** Charges all of `amount` to the AW3 Credit. False when refused or the hub is down. */
export async function aw3Deduct(email: string, amount: number, reason: string, key: string) {
  if (!aw3Enabled()) return false;
  const res = await hub("credits-api/deduct", {
    method: "POST",
    idempotencyKey: `${AW3_SLUG}:${key}`,
    body: mutation(email, amount, reason),
  });
  return res.ok;
}

/** Gives a charge paid in AW3 Credit back to the hub wallet. */
export async function aw3Refund(email: string, amount: number, reason: string, key: string) {
  if (!aw3Enabled()) return false;
  const res = await hub("credits-api/issue", {
    method: "POST",
    idempotencyKey: `${AW3_SLUG}:${key}`,
    body: mutation(email, amount, reason),
  });
  return res.ok;
}

/** 50 AW3 Credits once per person across every AW3 app; replays are no-ops. */
export async function aw3Welcome(email: string) {
  const cfg = aw3Config();
  if (!cfg) return false;
  const res = await hub("credits-api/issue", {
    method: "POST",
    idempotencyKey: `aw3-welcome:${email}`,
    body: { user_id: email, user_email: email, credit_type_id: cfg.creditTypeId, amount: 50, reason: "Electrum welcome credits" },
  });
  return "data" in res || res.code === "IDEMPOTENCY_KEY_REUSED";
}
