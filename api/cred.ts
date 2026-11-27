/**
 * Proxy to the Cred credits API for the dashboard. Injects the signed-in
 * user's identity and the server-side API key.
 *
 * Only read and purchase routes are exposed. Credits are deducted and
 * refunded server-side by the hosted API (api/_lib/credits.ts), never from
 * the browser — otherwise anyone could `issue` themselves credits.
 *
 * With Electrum on (ELECTRUM_ENABLED=true, api/_lib/electrum.ts) and a verified
 * email, all on OpenEye's own key: the balance carries `shared_balance` (Electrum,
 * shown apart from OpenEye credits); OpenEye's own packs stay on sale exactly as
 * before, with the Electrum packs listed beside them as `electrum_tiers` (only
 * their checkout is `shared: true`); and syncing the user grants the 1 Electrum
 * welcome once per person, on top of whatever OpenEye grants a new account.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleError, pathSegments, readRawBody, restoreRewrittenUrl, sendJson } from "./_lib/http.js";
import { requireUser } from "./_lib/session.js";
import { cred, electrumEmail, electrumWelcome } from "./_lib/electrum.js";

type Tier = { id: string };

/** The Electrum packs ($5 / $10 / $25), or null when cred.diy can't list them. */
async function electrumTiers(): Promise<Tier[] | null> {
  const res = await cred<{ pricing_tiers?: Tier[] }>("credits-api/pricing-tiers?shared=true");
  return res.ok ? (res.data.pricing_tiers ?? []) : null;
}

const CRED_API_BASE = process.env.CRED_API_BASE || "https://eutdgemlrpvnxfkkpvlu.supabase.co/functions/v1";

/** App origin used for Cred first-touch attribution. */
const APP_ORIGIN = process.env.CRED_APP_ORIGIN || "https://openeye.sh";

/** Allowed proxy routes and their method. */
const ROUTES: Record<string, "GET" | "POST"> = {
  balance: "GET",
  transactions: "GET",
  "pricing-tiers": "GET",
  users: "POST",
  checkout: "POST",
  "presale-checkout": "POST",
};

function targetUrl(path: string, search: URLSearchParams) {
  const qs = search.toString();
  const suffix = qs ? `?${qs}` : "";
  if (path === "checkout" || path.startsWith("checkout/")) {
    const rest = path.replace(/^checkout\/?/, "");
    return `${CRED_API_BASE}/hosted-checkout${rest ? `/${rest}` : ""}${suffix}`;
  }
  if (path === "presale-checkout" || path.startsWith("presale-checkout/")) {
    const rest = path.replace(/^presale-checkout\/?/, "");
    return `${CRED_API_BASE}/presale-checkout${rest ? `/${rest}` : ""}${suffix}`;
  }
  return `${CRED_API_BASE}/credits-api/${path}${suffix}`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  restoreRewrittenUrl(req, "/api/cred");
  try {
    const user = await requireUser(req);
    const apiKey = process.env.CRED_API_KEY;
    if (!apiKey) return sendJson(res, 500, { error: "CRED_API_KEY not configured" });

    const { segments, query: search } = pathSegments(req, "/api/cred");
    const path = segments.join("/");
    const method = req.method || "GET";
    const userEmail = user.email || undefined;

    if (ROUTES[path] !== method) {
      return sendJson(res, ROUTES[path] ? 405 : 404, { error: "Not available" });
    }

    // Identity always comes from the session: drop any the client sent.
    search.delete("user_id");
    search.delete("email");
    if (path === "balance" || path === "transactions") {
      if (userEmail) search.set("email", userEmail);
      else search.set("user_id", user.id);
    }

    // Electrum, for a verified email only (else OpenEye's own credits alone).
    const sharedEmail = electrumEmail(user.email, user.emailVerified);
    if (path === "balance" && sharedEmail) {
      search.set("email", sharedEmail);
      search.set("include_shared", "true");
    }

    const upstreamUrl = targetUrl(path, search);
    let body: string | undefined;
    if (method === "POST") {
      const rawBody = (await readRawBody(req, 100_000)).toString("utf8");
      const signupUrl = (req.headers["x-signup-url"] as string | undefined) || APP_ORIGIN;
      try {
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        // Identity always comes from the session, never from the client.
        if (path === "users") parsed.external_id = user.id;
        parsed.user_id = user.id;
        if (userEmail) {
          parsed.user_email = userEmail;
          parsed.email = userEmail;
        }
        if (!parsed.name) parsed.name = user.name || userEmail?.split("@")[0];
        // Cred first-touch attribution (recorded once, never overwritten)
        if (!parsed.signup_url) parsed.signup_url = signupUrl;
        if (path === "checkout" && sharedEmail && (await electrumTiers())?.some((t) => t.id === parsed.pricing_tier_id)) {
          // An Electrum pack: bought into the person's Electrum wallet, keyed by email.
          Object.assign(parsed, { shared: true, user_id: sharedEmail, user_email: sharedEmail, email: sharedEmail });
        }
        body = JSON.stringify(parsed);
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON body" });
      }
    }

    const upstream = await fetch(upstreamUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-app-origin": APP_ORIGIN,
      },
      body,
    });

    const data = await upstream.text();
    if (data) {
      try {
        JSON.parse(data);
      } catch {
        console.error("[api/cred] upstream returned non-JSON:", data.substring(0, 500));
        return sendJson(res, 502, { error: "Upstream returned invalid response", status: upstream.status });
      }
    }

    // Filter balance response to configured credit type
    let responseData = data || "{}";
    const creditTypeId = process.env.CRED_CREDIT_TYPE_ID;
    if (path === "balance" && upstream.status === 200 && creditTypeId) {
      const parsed = JSON.parse(responseData);
      if (Array.isArray(parsed.balances)) {
        parsed.balances = parsed.balances.filter(
          (b: { credit_type_id?: string }) => b.credit_type_id === creditTypeId,
        );
        responseData = JSON.stringify(parsed);
      }
    }

    // OpenEye's own packs as before, plus the Electrum packs listed apart (never as OpenEye credits).
    if (path === "pricing-tiers" && upstream.status === 200 && sharedEmail) {
      const electrum = await electrumTiers();
      if (electrum?.length) {
        const parsed = JSON.parse(responseData);
        parsed.electrum_tiers = electrum;
        responseData = JSON.stringify(parsed);
      }
    }

    // The welcome grant rides on the dashboard's user sync (once per person, every AW3 app).
    if (path === "users" && sharedEmail) await electrumWelcome(sharedEmail);

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(responseData);
  } catch (err) {
    handleError(res, err, "api/cred");
  }
}
