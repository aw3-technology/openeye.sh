/**
 * Proxy to the Cred credits API (ported from the Supabase `cred-proxy` edge
 * function). Injects the signed-in user's identity and the server-side API key.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleError, pathSegments, readRawBody, requireUser, sendJson } from "../_lib/http.js";

const CRED_API_BASE = process.env.CRED_API_BASE || "https://eutdgemlrpvnxfkkpvlu.supabase.co/functions/v1";

/** App origin used for Cred first-touch attribution. */
const APP_ORIGIN = process.env.CRED_APP_ORIGIN || "https://openeye.sh";

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
  try {
    const user = await requireUser(req);
    const apiKey = process.env.CRED_API_KEY;
    if (!apiKey) return sendJson(res, 500, { error: "CRED_API_KEY not configured" });

    const { segments, query: search } = pathSegments(req, "/api/cred");
    const path = segments.join("/");
    const method = req.method || "GET";
    const userEmail = user.email || undefined;

    // For balance requests, auto-inject user identity as query params
    if (path === "balance" && method === "GET" && !search.has("user_id") && !search.has("email")) {
      if (userEmail) search.set("email", userEmail);
      else search.set("user_id", user.id);
    }

    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      const rawBody = (await readRawBody(req, 100_000)).toString("utf8");
      const signupUrl = (req.headers["x-signup-url"] as string | undefined) || APP_ORIGIN;
      try {
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        if (path === "users" && !parsed.external_id) parsed.external_id = user.id;
        // Identity always comes from the session, never from the client.
        parsed.user_id = user.id;
        if (userEmail) {
          parsed.user_email = userEmail;
          parsed.email = userEmail;
        }
        if (!parsed.name) parsed.name = user.name || userEmail?.split("@")[0];
        // Cred first-touch attribution (recorded once, never overwritten)
        if (!parsed.signup_url) parsed.signup_url = signupUrl;
        body = JSON.stringify(parsed);
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON body" });
      }
    }

    const upstream = await fetch(targetUrl(path, search), {
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

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(responseData);
  } catch (err) {
    handleError(res, err, "api/cred");
  }
}
