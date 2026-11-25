/**
 * Proxy to the Cred credits API for the dashboard. Injects the signed-in
 * user's identity and the server-side API key.
 *
 * Only read and purchase routes are exposed. Credits are deducted and
 * refunded server-side by the hosted API (api/_lib/credits.ts), never from
 * the browser — otherwise anyone could `issue` themselves credits.
 *
 * With the shared AW3 Credit on (api/_lib/aw3-credit.ts) and a verified email:
 * the balance adds the AW3 Credit, the credit pack on sale is the hub's AW3
 * tier and its checkout runs on the hub, and syncing the user grants the AW3
 * welcome credits once.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleError, pathSegments, readRawBody, restoreRewrittenUrl, sendJson } from "./_lib/http.js";
import { requireUser } from "./_lib/session.js";
import { aw3BalanceEntry, aw3Config, aw3Welcome, hub, trustedEmail } from "./_lib/aw3-credit.js";

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

    // The shared AW3 wallet, for a verified email only (else OpenEye's own credits alone).
    const aw3 = aw3Config();
    const hubEmail = aw3 ? trustedEmail(user.email, user.emailVerified) : null;

    if (path === "pricing-tiers" && aw3 && hubEmail) {
      // New purchases buy AW3 Credit. A hub hiccup falls back to OpenEye's own packs.
      const tiers = await hub<{ pricing_tiers?: { id: string }[] }>("credits-api/pricing-tiers");
      const mine = tiers.ok ? (tiers.data.pricing_tiers ?? []).filter((t) => t.id === aw3.pricingTierId) : [];
      if (mine.length) return sendJson(res, 200, { pricing_tiers: mine });
    }

    const upstreamUrl = targetUrl(path, search);
    let upstreamKey = apiKey;
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
        if (path === "checkout" && aw3 && hubEmail && (!parsed.pricing_tier_id || parsed.pricing_tier_id === aw3.pricingTierId)) {
          // The AW3 pack: checkout on the hub, for the hub wallet keyed by email.
          Object.assign(parsed, { user_id: hubEmail, user_email: hubEmail, email: hubEmail, pricing_tier_id: aw3.pricingTierId });
          upstreamKey = aw3.apiKey;
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
        "x-api-key": upstreamKey,
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

    // Balance shown = OpenEye's own + the AW3 Credit (as its own entry).
    if (path === "balance" && upstream.status === 200 && hubEmail) {
      const shared = await aw3BalanceEntry(hubEmail);
      const parsed = JSON.parse(responseData);
      if (shared && Array.isArray(parsed.balances)) {
        parsed.balances.push(shared);
        responseData = JSON.stringify(parsed);
      }
    }

    // The welcome grant rides on the dashboard's user sync (once per person, every AW3 app).
    if (path === "users" && hubEmail) await aw3Welcome(hubEmail);

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(responseData);
  } catch (err) {
    handleError(res, err, "api/cred");
  }
}
