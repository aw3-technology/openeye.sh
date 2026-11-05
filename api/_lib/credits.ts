/**
 * Server-side credit checks against the Cred credits API, mirroring
 * backend/src/fleet/services/credits_service.py. If CRED_API_KEY is unset (or
 * OPENEYE_CREDITS_DISABLED=true), credits are disabled: every call is allowed
 * and nothing is charged.
 */

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
}

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

export async function getBalance(user: CreditUser): Promise<number> {
  if (!creditsEnabled()) return 0;
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

/** Returns false when Cred refuses the deduction; throws on other failures. */
export async function deduct(user: CreditUser, amount: number, reason: string): Promise<boolean> {
  if (!creditsEnabled()) return true;
  const res = await fetch(`${CRED_API_BASE}/credits-api/deduct`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(mutationBody(user, amount, reason)),
  });
  if (DENIED_STATUSES.has(res.status)) return false;
  if (!res.ok) throw new Error(`Cred deduct failed (${res.status})`);
  return true;
}

/** Best-effort refund after a failed inference. */
export async function refund(user: CreditUser, amount: number, reason: string): Promise<void> {
  if (!creditsEnabled()) return;
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
