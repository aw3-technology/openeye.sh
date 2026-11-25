/**
 * Server-side credit checks against the Cred credits API, mirroring
 * backend/src/fleet/services/credits_service.py. If CRED_API_KEY is unset (or
 * OPENEYE_CREDITS_DISABLED=true), credits are disabled: every call is allowed
 * and nothing is charged.
 *
 * With Electrum on (ELECTRUM_ENABLED=true, api/_lib/electrum.ts) and a verified
 * email, the one /deduct call carries `shared_fallback: true`: cred.diy charges
 * OpenEye's credits when they cover it, else all of it in Electrum (converted at
 * the type's shared_rate, never split), and says which in `paid_from`. A refund
 * of an Electrum-paid charge goes back by transaction id with `shared: true`.
 */
import { electrumEmail, electrumRefund, type CreditSource } from "./electrum.js";

export type { CreditSource };

/** A charge that went through: who paid, and cred.diy's transaction id. */
export interface Charge {
  source: CreditSource;
  transactionId?: string;
}

const CRED_API_BASE = process.env.CRED_API_BASE || "https://eutdgemlrpvnxfkkpvlu.supabase.co/functions/v1";
const APP_ORIGIN = process.env.CRED_APP_ORIGIN || "https://openeye.sh";

/**
 * Cred replies with these when a deduction is refused: insufficient balance,
 * or 404 when the user has no Cred account yet (they've never bought credits).
 */
const DENIED_STATUSES = new Set([400, 402, 404, 409, 422]);

export const CREDIT_COSTS = { detect: 1, depth: 2, describe: 3 } as const;

export interface CreditUser {
  id: string;
  email?: string | null;
  /** Only a verified email reaches the person's Electrum wallet. */
  emailVerified?: boolean | null;
}

/** The user's Electrum wallet email, or null when Electrum doesn't apply to them. */
const sharedEmail = (user: CreditUser) => electrumEmail(user.email, user.emailVerified);

/** OPENEYE_CREDITS_DISABLED=true turns billing off (used for branch previews; never set in production). */
export const creditsEnabled = () =>
  Boolean(process.env.CRED_API_KEY) && process.env.OPENEYE_CREDITS_DISABLED !== "true";

function headers() {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.CRED_API_KEY ?? "",
    "x-app-origin": APP_ORIGIN,
  };
}

function mutationBody(user: CreditUser, amount: number, reason: string) {
  const body: Record<string, unknown> = { user_id: user.id, amount, reason };
  if (user.email) {
    body.email = user.email;
    body.user_email = user.email;
  }
  if (process.env.CRED_CREDIT_TYPE_ID) body.credit_type_id = process.env.CRED_CREDIT_TYPE_ID;
  return body;
}

/** OpenEye's own credit balance (Electrum is shown separately, see api/cred.ts). */
export async function getBalance(user: CreditUser): Promise<number> {
  if (!creditsEnabled()) return 0;
  return (await getBalances(user)).app;
}

/** OpenEye's own balance, and the person's Electrum (null when off, unverified or not returned). */
export async function getBalances(user: CreditUser): Promise<{ app: number; electrum: number | null }> {
  if (!creditsEnabled()) return { app: 0, electrum: null };
  const email = sharedEmail(user);
  const qs = new URLSearchParams(user.email ? { email: user.email } : { user_id: user.id });
  if (email) {
    qs.set("email", email);
    qs.set("include_shared", "true");
  }
  const res = await fetch(`${CRED_API_BASE}/credits-api/balance?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(`Cred balance failed (${res.status})`);
  const data = (await res.json()) as {
    balance?: number;
    balances?: { balance?: number; credit_type_id?: string }[];
    shared_balance?: { balance?: number } | null;
  };
  let app = Number(data.balance ?? 0);
  if (Array.isArray(data.balances)) {
    const type = process.env.CRED_CREDIT_TYPE_ID;
    app = data.balances
      .filter((b) => !type || b.credit_type_id === type)
      .reduce((sum, b) => sum + Number(b.balance ?? 0), 0);
  }
  const electrum = email && data.shared_balance ? Number(data.shared_balance.balance ?? 0) : null;
  return { app, electrum };
}

/**
 * Charges `amount` in one /deduct call. With Electrum on and a verified email,
 * cred.diy falls back to Electrum when OpenEye's credits can't cover all of it.
 * Returns the charge, or false when it was refused; throws on other failures.
 */
export async function deduct(user: CreditUser, amount: number, reason: string): Promise<Charge | false> {
  if (!creditsEnabled()) return { source: "app" };
  const email = sharedEmail(user);
  const body = mutationBody(user, amount, reason);
  if (email) Object.assign(body, { shared_fallback: true, user_email: email, email });
  let res = await postDeduct(body);
  if (email && res.status === 400) {
    // Hub not linked / no shared_rate yet: cred.diy refused before writing
    // anything, so the same call without the fallback is safe.
    const code = ((await res.clone().json().catch(() => ({}))) as { code?: string }).code;
    if (code === "SHARED_NOT_LINKED" || code === "SHARED_RATE_MISSING") {
      console.warn(`[credits] Electrum fallback unavailable (${code}); charging OpenEye credits only`);
      delete body.shared_fallback;
      res = await postDeduct(body);
    }
  }
  if (DENIED_STATUSES.has(res.status)) return false;
  if (!res.ok) throw new Error(`Cred deduct failed (${res.status})`);
  const data = (await res.json().catch(() => ({}))) as { paid_from?: string; transaction_id?: string };
  return { source: data.paid_from === "shared" ? "shared" : "app", transactionId: data.transaction_id };
}

function postDeduct(body: Record<string, unknown>) {
  return fetch(`${CRED_API_BASE}/credits-api/deduct`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
}

/** Best-effort refund after a failed inference, to the balance that paid. */
export async function refund(user: CreditUser, amount: number, reason: string, charge: Charge = { source: "app" }): Promise<void> {
  if (!creditsEnabled()) return;
  if (charge.source === "shared") {
    if (!charge.transactionId || !(await electrumRefund(charge.transactionId, reason))) {
      console.error("[credits] Electrum refund failed", { transactionId: charge.transactionId, reason });
    }
    return;
  }
  try {
    await fetch(`${CRED_API_BASE}/credits-api/issue`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(mutationBody(user, amount, reason)),
    });
  } catch (err) {
    console.error("[credits] refund failed", err);
  }
}
