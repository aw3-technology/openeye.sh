/**
 * Server-side credit checks against the Cred credits API, mirroring
 * backend/src/fleet/services/credits_service.py. If CRED_API_KEY is unset (or
 * OPENEYE_CREDITS_DISABLED=true), credits are disabled: every call is allowed
 * and nothing is charged.
 *
 * With the AW3 Credit on (api/_lib/aw3-credit.ts), a charge OpenEye's own
 * balance can't cover is charged in full to the shared AW3 Credit instead
 * (never split), and the refund goes back to whichever balance paid.
 */
import { randomUUID } from "node:crypto";
import { aw3Balance, aw3Deduct, aw3Enabled, aw3Refund, trustedEmail, type CreditSource } from "./aw3-credit.js";

export type { CreditSource };

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
  /** Only a verified email reaches the shared AW3 wallet. */
  emailVerified?: boolean | null;
}

/** The user's hub wallet email, or null when the AW3 Credit doesn't apply to them. */
const aw3Email = (user: CreditUser) => (aw3Enabled() ? trustedEmail(user.email, user.emailVerified) : null);

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

/** OpenEye's own balance plus the shared AW3 Credit (when on and reachable). */
export async function getBalance(user: CreditUser): Promise<number> {
  if (!creditsEnabled()) return 0;
  const email = aw3Email(user);
  const [legacy, shared] = await Promise.all([legacyBalance(user), email ? aw3Balance(email) : null]);
  return legacy + (shared ?? 0);
}

async function legacyBalance(user: CreditUser): Promise<number> {
  const qs = new URLSearchParams(user.email ? { email: user.email } : { user_id: user.id });
  const res = await fetch(`${CRED_API_BASE}/credits-api/balance?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(`Cred balance failed (${res.status})`);
  const data = (await res.json()) as { balance?: number; balances?: { balance?: number; credit_type_id?: string }[] };
  if (Array.isArray(data.balances)) {
    const type = process.env.CRED_CREDIT_TYPE_ID;
    return data.balances
      .filter((b) => !type || b.credit_type_id === type)
      .reduce((sum, b) => sum + Number(b.balance ?? 0), 0);
  }
  return Number(data.balance ?? 0);
}

/**
 * Charges `amount`: OpenEye's own credits first, else all of it to the AW3
 * Credit. Returns the source that paid, or false when neither can cover it;
 * throws on other failures of the legacy API.
 */
export async function deduct(user: CreditUser, amount: number, reason: string): Promise<CreditSource | false> {
  if (!creditsEnabled()) return "app";
  if (await legacyDeduct(user, amount, reason)) return "app";
  const email = aw3Email(user);
  if (!email) return false;
  return (await aw3Deduct(email, amount, reason, `deduct:${randomUUID()}`)) ? "aw3" : false;
}

async function legacyDeduct(user: CreditUser, amount: number, reason: string): Promise<boolean> {
  const res = await fetch(`${CRED_API_BASE}/credits-api/deduct`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(mutationBody(user, amount, reason)),
  });
  if (DENIED_STATUSES.has(res.status)) return false;
  if (!res.ok) throw new Error(`Cred deduct failed (${res.status})`);
  return true;
}

/** Best-effort refund after a failed inference, to the balance that paid. */
export async function refund(user: CreditUser, amount: number, reason: string, source: CreditSource = "app"): Promise<void> {
  if (!creditsEnabled()) return;
  if (source === "aw3") {
    const email = aw3Email(user);
    if (!email || !(await aw3Refund(email, amount, reason, `refund:${randomUUID()}`))) {
      console.error("[credits] AW3 refund failed", { amount, reason });
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
